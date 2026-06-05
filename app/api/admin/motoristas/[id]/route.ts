import { NextRequest, NextResponse } from 'next/server'
import { normalizeOptionalText } from '@/lib/driver-utils'
import { getDriverDetails, listDriverVehicleOptions } from '@/lib/drivers-repository'
import { managedUserErrorResponse, updateManagedUser } from '@/lib/managed-users'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'
import type { DriverProfessionalStatus } from '@/types/driver'

const professionalStatuses: DriverProfessionalStatus[] = ['ativo', 'inativo', 'afastado']

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  try {
    const [driver, vehicles] = await Promise.all([
      getDriverDetails(auth.supabase, id),
      listDriverVehicleOptions(auth.supabase),
    ])

    if (!driver) {
      return NextResponse.json({ error: 'Motorista não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ driver, vehicles })
  } catch (error) {
    return managedUserErrorResponse(error, 'motorista', 'Não foi possível carregar o motorista.', 500)
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
  const cpf = String(body.cpf ?? '').trim()
  const address = String(body.address ?? '').trim()
  const licenseNumber = String(body.licenseNumber ?? '').trim()
  const licenseCategory = String(body.licenseCategory ?? '').trim()
  const licenseDueDate = String(body.licenseDueDate ?? '').trim()
  const professionalStatus = String(body.professionalStatus ?? 'ativo') as DriverProfessionalStatus
  const accessActive = body.accessActive !== false
  const notes = normalizeOptionalText(body.notes)
  const vehicleId = normalizeOptionalText(body.vehicleId)

  if (!name || !email || !cpf || !licenseNumber || !licenseDueDate) {
    return NextResponse.json(
      { error: 'Nome, email, CPF, número e validade da CNH são obrigatórios.' },
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
    const { data: currentDriver, error: currentDriverError } = await service
      .from('motoristas')
      .select('id,perfil_id')
      .eq('id', id)
      .is('excluido_em', null)
      .single<{ id: string; perfil_id: string }>()

    if (currentDriverError || !currentDriver) {
      return NextResponse.json({ error: 'Motorista não encontrado.' }, { status: 404 })
    }

    await updateManagedUser(service, auth.user.id, currentDriver.perfil_id, {
      name,
      email,
      password,
      phone,
      active: accessActive,
      role: 'motorista',
    })

    const { error: driverError } = await service
      .from('motoristas')
      .update({
        cpf,
        endereco: address || null,
        numero_habilitacao: licenseNumber,
        categoria_habilitacao: licenseCategory || null,
        validade_habilitacao: licenseDueDate,
        status_profissional: professionalStatus,
        observacoes: notes,
        atualizado_por: auth.user.id,
      })
      .eq('id', id)

    if (driverError) throw driverError

    const { data: activeAssignments, error: assignmentsError } = await service
      .from('veiculo_motoristas')
      .select('id,veiculo_id,principal')
      .eq('motorista_id', id)
      .eq('ativo', true)
      .is('fim_em', null)

    if (assignmentsError) throw assignmentsError

    const currentVehicleId =
      activeAssignments?.find((assignment) => assignment.principal)?.veiculo_id
      ?? activeAssignments?.[0]?.veiculo_id
      ?? null

    if (currentVehicleId !== vehicleId) {
      if (activeAssignments?.length) {
        const { error: closeError } = await service
          .from('veiculo_motoristas')
          .update({
            ativo: false,
            fim_em: new Date().toISOString(),
            atualizado_por: auth.user.id,
          })
          .in('id', activeAssignments.map((assignment) => assignment.id))

        if (closeError) throw closeError
      }

      if (vehicleId) {
        const { data: currentPrimary, error: primaryError } = await service
          .from('veiculo_motoristas')
          .select('id')
          .eq('veiculo_id', vehicleId)
          .eq('ativo', true)
          .eq('principal', true)
          .is('fim_em', null)
          .maybeSingle()

        if (primaryError) throw primaryError

        const { error: assignmentError } = await service.from('veiculo_motoristas').insert({
          veiculo_id: vehicleId,
          motorista_id: id,
          ativo: true,
          principal: !currentPrimary,
          tipo_vinculo: 'regular',
          criado_por: auth.user.id,
          atualizado_por: auth.user.id,
        })

        if (assignmentError) throw assignmentError
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return managedUserErrorResponse(error, 'motorista', 'Não foi possível atualizar o motorista.')
  }
}
