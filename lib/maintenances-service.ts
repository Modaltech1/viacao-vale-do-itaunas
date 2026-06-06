import 'server-only'

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeOptionalText } from '@/lib/driver-utils'
import type { MaintenanceStatus, MaintenanceType } from '@/types/fleet'

const maintenanceTypes: MaintenanceType[] = ['preventiva', 'corretiva']
const editableStatuses = ['aberta', 'em_andamento'] as const

export type MaintenancePayload = {
  vehicleId: string
  maintenanceType: MaintenanceType
  cause: string
  openedAt: string
  vehicleKm: number
  responsibleMechanicId: string
  status: (typeof editableStatuses)[number]
  totalValue: number | null
  notes: string | null
  serviceIds: string[]
}

export function parseMaintenancePayload(
  body: Record<string, unknown>,
  forcedMechanicId?: string,
): MaintenancePayload {
  const vehicleKmText = String(body.vehicleKm ?? '').replace(',', '.').trim()
  const totalValueText = String(body.totalValue ?? '').replace(',', '.').trim()

  const payload: MaintenancePayload = {
    vehicleId: String(body.vehicleId ?? '').trim(),
    maintenanceType: String(body.maintenanceType ?? 'preventiva') as MaintenanceType,
    cause: String(body.cause ?? '').trim(),
    openedAt: String(body.openedAt ?? '').trim(),
    vehicleKm: Number(vehicleKmText),
    responsibleMechanicId: forcedMechanicId ?? String(body.responsibleMechanicId ?? '').trim(),
    status: String(body.status ?? 'aberta') as MaintenancePayload['status'],
    totalValue: totalValueText ? Number(totalValueText) : null,
    notes: normalizeOptionalText(body.notes),
    serviceIds: Array.isArray(body.serviceIds)
      ? [...new Set(body.serviceIds.map((id) => String(id).trim()).filter(Boolean))]
      : [],
  }

  validateMaintenancePayload(payload)
  return payload
}

function validateMaintenancePayload(payload: MaintenancePayload) {
  if (!payload.vehicleId) throw new Error('Selecione o veículo.')
  if (!maintenanceTypes.includes(payload.maintenanceType)) {
    throw new Error('Tipo de manutenção inválido.')
  }
  if (!payload.cause) throw new Error('Informe a causa ou descrição da manutenção.')
  if (!payload.openedAt || Number.isNaN(new Date(payload.openedAt).getTime())) {
    throw new Error('Informe uma data de abertura válida.')
  }
  if (!Number.isFinite(payload.vehicleKm) || payload.vehicleKm < 0) {
    throw new Error('Informe uma quilometragem válida.')
  }
  if (!payload.responsibleMechanicId) throw new Error('Selecione o mecânico responsável.')
  if (!editableStatuses.includes(payload.status)) throw new Error('Status de manutenção inválido.')
  if (payload.totalValue != null && (!Number.isFinite(payload.totalValue) || payload.totalValue < 0)) {
    throw new Error('O valor total não pode ser negativo.')
  }
  if (!payload.serviceIds.length) throw new Error('Selecione pelo menos um serviço.')
}

async function validateRelations(client: SupabaseClient, payload: MaintenancePayload) {
  const [vehicleResult, mechanicResult, servicesResult, tripResult] = await Promise.all([
    client
      .from('veiculos')
      .select('id,km_atual,status_operacional')
      .eq('id', payload.vehicleId)
      .is('excluido_em', null)
      .single(),
    client
      .from('mecanicos')
      .select('id')
      .eq('id', payload.responsibleMechanicId)
      .eq('status_profissional', 'ativo')
      .is('excluido_em', null)
      .single(),
    client
      .from('servicos')
      .select('id,nome,categoria')
      .in('id', payload.serviceIds)
      .eq('ativo', true)
      .is('excluido_em', null),
    client
      .from('viagens')
      .select('id')
      .eq('veiculo_id', payload.vehicleId)
      .eq('status', 'em_andamento')
      .maybeSingle(),
  ])

  if (vehicleResult.error || !vehicleResult.data) throw new Error('Veículo não encontrado.')
  if (mechanicResult.error || !mechanicResult.data) throw new Error('Mecânico responsável inválido.')
  if (servicesResult.error || servicesResult.data?.length !== payload.serviceIds.length) {
    throw new Error('Um ou mais serviços não estão disponíveis.')
  }
  if (tripResult.data) {
    throw new Error('O veículo possui uma viagem em andamento e não pode entrar em manutenção.')
  }
  if (payload.vehicleKm < Number(vehicleResult.data.km_atual)) {
    throw new Error('O KM da manutenção não pode ser menor que o KM atual do veículo.')
  }

  return { vehicle: vehicleResult.data, services: servicesResult.data ?? [] }
}

async function replaceMaintenanceServices(
  client: SupabaseClient,
  maintenanceId: string,
  serviceIds: string[],
  userId: string,
) {
  const { error: deleteError } = await client
    .from('manutencao_servicos')
    .delete()
    .eq('manutencao_id', maintenanceId)
  if (deleteError) throw deleteError

  const { error } = await client.from('manutencao_servicos').insert(
    serviceIds.map((serviceId) => ({
      manutencao_id: maintenanceId,
      servico_id: serviceId,
      criado_por: userId,
      atualizado_por: userId,
    })),
  )
  if (error) throw error
}

async function replaceResponsibleMechanic(
  client: SupabaseClient,
  maintenanceId: string,
  mechanicId: string,
  userId: string,
) {
  const { error: deleteError } = await client
    .from('manutencao_mecanicos')
    .delete()
    .eq('manutencao_id', maintenanceId)
    .eq('papel', 'responsavel')
  if (deleteError) throw deleteError

  const { error } = await client.from('manutencao_mecanicos').insert({
    manutencao_id: maintenanceId,
    mecanico_id: mechanicId,
    papel: 'responsavel',
    criado_por: userId,
  })
  if (error) throw error
}

async function restoreVehicleIfAvailable(client: SupabaseClient, vehicleId: string, userId: string) {
  const { count, error } = await client
    .from('manutencoes')
    .select('id', { count: 'exact', head: true })
    .eq('veiculo_id', vehicleId)
    .in('status', ['aberta', 'em_andamento'])

  if (error) throw error
  if (count) return

  const { error: updateError } = await client
    .from('veiculos')
    .update({ status_operacional: 'ativo', atualizado_por: userId })
    .eq('id', vehicleId)
    .eq('status_operacional', 'em_manutencao')
  if (updateError) throw updateError
}

export async function createMaintenance(
  client: SupabaseClient,
  payload: MaintenancePayload,
  userId: string,
) {
  await validateRelations(client, payload)
  let maintenanceId: string | null = null

  try {
    const { data, error } = await client
      .from('manutencoes')
      .insert({
        veiculo_id: payload.vehicleId,
        tipo_manutencao: payload.maintenanceType,
        causa: payload.cause,
        aberto_em: payload.openedAt,
        iniciado_em: payload.status === 'em_andamento' ? new Date().toISOString() : null,
        km_veiculo: payload.vehicleKm,
        mecanico_responsavel_id: payload.responsibleMechanicId,
        status: payload.status,
        valor_total_informado: payload.totalValue,
        observacoes: payload.notes,
        criado_por: userId,
        atualizado_por: userId,
      })
      .select('id')
      .single<{ id: string }>()

    if (error || !data) throw error ?? new Error('Não foi possível criar a manutenção.')
    maintenanceId = data.id

    await replaceMaintenanceServices(client, maintenanceId, payload.serviceIds, userId)
    await replaceResponsibleMechanic(
      client,
      maintenanceId,
      payload.responsibleMechanicId,
      userId,
    )

    const { error: vehicleError } = await client
      .from('veiculos')
      .update({
        status_operacional: 'em_manutencao',
        km_atual: payload.vehicleKm,
        atualizado_por: userId,
      })
      .eq('id', payload.vehicleId)
    if (vehicleError) throw vehicleError

    return maintenanceId
  } catch (error) {
    if (maintenanceId) await client.from('manutencoes').delete().eq('id', maintenanceId)
    throw error
  }
}

export async function updateMaintenance(
  client: SupabaseClient,
  maintenanceId: string,
  payload: MaintenancePayload,
  userId: string,
) {
  const { data: current, error: currentError } = await client
    .from('manutencoes')
    .select('*')
    .eq('id', maintenanceId)
    .single()

  if (currentError || !current) throw new Error('Manutenção não encontrada.')
  if (!editableStatuses.includes(current.status)) {
    throw new Error('Somente manutenções abertas ou em andamento podem ser editadas.')
  }

  await validateRelations(client, payload)
  const previousVehicleId = current.veiculo_id

  const { error } = await client
    .from('manutencoes')
    .update({
      veiculo_id: payload.vehicleId,
      tipo_manutencao: payload.maintenanceType,
      causa: payload.cause,
      aberto_em: payload.openedAt,
      iniciado_em: payload.status === 'em_andamento'
        ? current.iniciado_em ?? new Date().toISOString()
        : null,
      km_veiculo: payload.vehicleKm,
      mecanico_responsavel_id: payload.responsibleMechanicId,
      status: payload.status,
      valor_total_informado: payload.totalValue,
      observacoes: payload.notes,
      atualizado_por: userId,
    })
    .eq('id', maintenanceId)
  if (error) throw error

  await replaceMaintenanceServices(client, maintenanceId, payload.serviceIds, userId)
  await replaceResponsibleMechanic(
    client,
    maintenanceId,
    payload.responsibleMechanicId,
    userId,
  )

  const { error: vehicleError } = await client
    .from('veiculos')
    .update({
      status_operacional: 'em_manutencao',
      km_atual: payload.vehicleKm,
      atualizado_por: userId,
    })
    .eq('id', payload.vehicleId)
  if (vehicleError) throw vehicleError

  if (previousVehicleId !== payload.vehicleId) {
    await restoreVehicleIfAvailable(client, previousVehicleId, userId)
  }
}

export async function cancelMaintenance(
  client: SupabaseClient,
  maintenanceId: string,
  reason: string,
  userId: string,
) {
  if (!reason.trim()) throw new Error('Informe o motivo do cancelamento.')

  const { data: maintenance, error: findError } = await client
    .from('manutencoes')
    .select('id,veiculo_id,status')
    .eq('id', maintenanceId)
    .single()
  if (findError || !maintenance) throw new Error('Manutenção não encontrada.')
  if (!editableStatuses.includes(maintenance.status)) {
    throw new Error('Esta manutenção não pode mais ser cancelada.')
  }

  const { error } = await client
    .from('manutencoes')
    .update({
      status: 'cancelada',
      cancelado_em: new Date().toISOString(),
      motivo_cancelamento: reason.trim(),
      atualizado_por: userId,
    })
    .eq('id', maintenanceId)
  if (error) throw error

  await restoreVehicleIfAvailable(client, maintenance.veiculo_id, userId)
}

export async function concludeMaintenance(
  sessionClient: SupabaseClient,
  maintenanceId: string,
) {
  const { error } = await sessionClient.rpc('fn_concluir_manutencao', {
    p_manutencao_id: maintenanceId,
  })
  if (error) throw error
}

export function maintenanceErrorResponse(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid api key')) {
    return NextResponse.json(
      { error: 'A configuração server-side do Supabase está inválida.' },
      { status: 500 },
    )
  }

  if (normalized.includes('duplicate')) {
    return NextResponse.json(
      { error: 'Já existe um vínculo duplicado nesta manutenção.' },
      { status: 409 },
    )
  }

  return NextResponse.json({ error: message || fallback }, { status })
}

export function isMaintenanceEditable(status: MaintenanceStatus) {
  return editableStatuses.includes(status as (typeof editableStatuses)[number])
}
