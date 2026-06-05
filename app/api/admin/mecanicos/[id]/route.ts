import { NextRequest, NextResponse } from 'next/server'
import { normalizeOptionalText } from '@/lib/driver-utils'
import { managedUserErrorResponse, updateManagedUser } from '@/lib/managed-users'
import { getMechanicDetails } from '@/lib/mechanics-repository'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'
import type { MechanicProfessionalStatus } from '@/types/mechanic'

const professionalStatuses: MechanicProfessionalStatus[] = ['ativo', 'inativo']

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  try {
    const mechanic = await getMechanicDetails(auth.supabase, id)

    if (!mechanic) {
      return NextResponse.json({ error: 'Mecânico não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ mechanic })
  } catch (error) {
    return managedUserErrorResponse(error, 'mecânico', 'Não foi possível carregar o mecânico.', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const body = await request.json()
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const phone = String(body.phone ?? '').trim()
  const specialty = String(body.specialty ?? '').trim()
  const professionalStatus = String(body.professionalStatus ?? 'ativo') as MechanicProfessionalStatus
  const accessActive = body.accessActive !== false
  const notes = normalizeOptionalText(body.notes)

  if (!name || !email || !specialty) {
    return NextResponse.json(
      { error: 'Nome, email e especialidade são obrigatórios.' },
      { status: 400 },
    )
  }

  if (password && password.length < 6) {
    return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  if (!professionalStatuses.includes(professionalStatus)) {
    return NextResponse.json({ error: 'Status profissional inválido.' }, { status: 400 })
  }

  const service = createSupabaseServiceClient()

  try {
    const { data: currentMechanic, error: currentMechanicError } = await service
      .from('mecanicos')
      .select('id,perfil_id')
      .eq('id', id)
      .is('excluido_em', null)
      .single<{ id: string; perfil_id: string }>()

    if (currentMechanicError || !currentMechanic) {
      return NextResponse.json({ error: 'Mecânico não encontrado.' }, { status: 404 })
    }

    await updateManagedUser(service, auth.user.id, currentMechanic.perfil_id, {
      name,
      email,
      password,
      phone,
      active: accessActive,
      role: 'mecanico',
    })

    const { error: mechanicError } = await service
      .from('mecanicos')
      .update({
        especialidade: specialty,
        status_profissional: professionalStatus,
        observacoes: notes,
        atualizado_por: auth.user.id,
      })
      .eq('id', id)

    if (mechanicError) throw mechanicError

    return NextResponse.json({ ok: true })
  } catch (error) {
    return managedUserErrorResponse(error, 'mecânico', 'Não foi possível atualizar o mecânico.')
  }
}
