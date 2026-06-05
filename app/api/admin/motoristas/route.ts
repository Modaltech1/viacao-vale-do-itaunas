import { NextRequest, NextResponse } from 'next/server'
import { normalizeOptionalText } from '@/lib/driver-utils'
import { listDrivers, listDriverVehicleOptions } from '@/lib/drivers-repository'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'
import type { DriverProfessionalStatus } from '@/types/driver'

const professionalStatuses: DriverProfessionalStatus[] = ['ativo', 'inativo', 'afastado']

function errorResponse(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid api key')) {
    return NextResponse.json(
      { error: 'A configuração server-side do Supabase está inválida.' },
      { status: 500 },
    )
  }

  if (normalized.includes('duplicate') || normalized.includes('already registered') || normalized.includes('already exists')) {
    return NextResponse.json({ error: 'Já existe um usuário ou motorista com esses dados.' }, { status: 409 })
  }

  return NextResponse.json({ error: message || fallback }, { status })
}

async function insertVehicleAssignment(
  service: ReturnType<typeof createSupabaseServiceClient>,
  driverId: string,
  vehicleId: string,
  adminId: string,
) {
  const { data: currentPrimary, error: primaryError } = await service
    .from('veiculo_motoristas')
    .select('id')
    .eq('veiculo_id', vehicleId)
    .eq('ativo', true)
    .eq('principal', true)
    .is('fim_em', null)
    .maybeSingle()

  if (primaryError) throw primaryError

  const { error } = await service.from('veiculo_motoristas').insert({
    veiculo_id: vehicleId,
    motorista_id: driverId,
    ativo: true,
    principal: !currentPrimary,
    tipo_vinculo: 'regular',
    criado_por: adminId,
    atualizado_por: adminId,
  })

  if (error) throw error
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const [items, vehicles] = await Promise.all([
      listDrivers(auth.supabase),
      listDriverVehicleOptions(auth.supabase),
    ])

    return NextResponse.json({ items, vehicles })
  } catch (error) {
    return errorResponse(error, 'Não foi possível carregar os motoristas.', 500)
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
  const cpf = String(body.cpf ?? '').trim()
  const address = String(body.address ?? '').trim()
  const licenseNumber = String(body.licenseNumber ?? '').trim()
  const licenseCategory = String(body.licenseCategory ?? '').trim()
  const licenseDueDate = String(body.licenseDueDate ?? '').trim()
  const professionalStatus = String(body.professionalStatus ?? 'ativo') as DriverProfessionalStatus
  const accessActive = body.accessActive !== false
  const notes = normalizeOptionalText(body.notes)
  const vehicleId = normalizeOptionalText(body.vehicleId)

  if (!name || !email || !password || !cpf || !licenseNumber || !licenseDueDate) {
    return NextResponse.json(
      { error: 'Nome, email, senha, CPF, número e validade da CNH são obrigatórios.' },
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
  let driverId: string | null = null

  try {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { papel: 'motorista' },
      user_metadata: { nome: name },
    })

    if (createError || !created.user) {
      throw createError ?? new Error('Não foi possível criar o usuário no Supabase Auth.')
    }

    authUserId = created.user.id

    const { error: profileError } = await service
      .from('perfis')
      .update({
        nome: name,
        email,
        telefone: phone || null,
        papel: 'motorista',
        ativo: accessActive,
        criado_por: auth.user.id,
        atualizado_por: auth.user.id,
      })
      .eq('id', authUserId)

    if (profileError) throw profileError

    const { data: driver, error: driverError } = await service
      .from('motoristas')
      .insert({
        perfil_id: authUserId,
        cpf,
        endereco: address || null,
        numero_habilitacao: licenseNumber,
        categoria_habilitacao: licenseCategory || null,
        validade_habilitacao: licenseDueDate,
        status_profissional: professionalStatus,
        observacoes: notes,
        criado_por: auth.user.id,
        atualizado_por: auth.user.id,
      })
      .select('id')
      .single<{ id: string }>()

    if (driverError || !driver) throw driverError ?? new Error('Não foi possível criar o cadastro profissional.')

    driverId = driver.id

    if (vehicleId) {
      await insertVehicleAssignment(service, driverId, vehicleId, auth.user.id)
    }

    return NextResponse.json({ ok: true, id: driverId }, { status: 201 })
  } catch (error) {
    if (driverId) {
      await service.from('motoristas').delete().eq('id', driverId)
    }
    if (authUserId) {
      await service.auth.admin.deleteUser(authUserId)
    }

    return errorResponse(error, 'Não foi possível criar o motorista.')
  }
}
