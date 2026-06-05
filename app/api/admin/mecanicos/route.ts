import { NextRequest, NextResponse } from 'next/server'
import { normalizeOptionalText } from '@/lib/driver-utils'
import {
  createManagedUser,
  deleteManagedUser,
  managedUserErrorResponse,
} from '@/lib/managed-users'
import { listMechanics } from '@/lib/mechanics-repository'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'
import type { MechanicProfessionalStatus } from '@/types/mechanic'

const professionalStatuses: MechanicProfessionalStatus[] = ['ativo', 'inativo']

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json({ items: await listMechanics(auth.supabase) })
  } catch (error) {
    return managedUserErrorResponse(error, 'mecânico', 'Não foi possível carregar os mecânicos.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const phone = String(body.phone ?? '').trim()
  const specialty = String(body.specialty ?? '').trim()
  const professionalStatus = String(body.professionalStatus ?? 'ativo') as MechanicProfessionalStatus
  const accessActive = body.accessActive !== false
  const notes = normalizeOptionalText(body.notes)

  if (!name || !email || !password || !specialty) {
    return NextResponse.json(
      { error: 'Nome, email, senha e especialidade são obrigatórios.' },
      { status: 400 },
    )
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  if (!professionalStatuses.includes(professionalStatus)) {
    return NextResponse.json({ error: 'Status profissional inválido.' }, { status: 400 })
  }

  const service = createSupabaseServiceClient()
  let authUserId: string | null = null
  let mechanicId: string | null = null

  try {
    authUserId = await createManagedUser(service, auth.user.id, {
      name,
      email,
      password,
      phone,
      active: accessActive,
      role: 'mecanico',
    })

    const { data: mechanic, error: mechanicError } = await service
      .from('mecanicos')
      .insert({
        perfil_id: authUserId,
        especialidade: specialty,
        status_profissional: professionalStatus,
        observacoes: notes,
        criado_por: auth.user.id,
        atualizado_por: auth.user.id,
      })
      .select('id')
      .single<{ id: string }>()

    if (mechanicError || !mechanic) {
      throw mechanicError ?? new Error('Não foi possível criar o cadastro profissional.')
    }

    mechanicId = mechanic.id
    return NextResponse.json({ ok: true, id: mechanicId }, { status: 201 })
  } catch (error) {
    if (mechanicId) await service.from('mecanicos').delete().eq('id', mechanicId)
    await deleteManagedUser(service, authUserId)

    return managedUserErrorResponse(error, 'mecânico', 'Não foi possível criar o mecânico.')
  }
}
