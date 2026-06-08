import 'server-only'

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeOptionalText } from '@/lib/driver-utils'
import type { MaintenanceStatus, MaintenanceType } from '@/types/fleet'

const maintenanceTypes: MaintenanceType[] = ['preventiva', 'corretiva']
const editableStatuses = ['aberta', 'em_andamento'] as const

export type MaintenancePartPayload = {
  partId: string
  quantity: number
  unitValue: number
}

export type MaintenancePayload = {
  vehicleId: string
  maintenanceType: MaintenanceType
  cause: string
  openedAt: string
  vehicleKm: number
  responsibleMechanicId: string
  status: (typeof editableStatuses)[number]
  notes: string | null
  serviceIds: string[]
  parts: MaintenancePartPayload[]
}

export function parseMaintenancePayload(
  body: Record<string, unknown>,
  forcedMechanicId?: string,
): MaintenancePayload {
  const vehicleKmText = String(body.vehicleKm ?? '').replace(',', '.').trim()
  const parts = Array.isArray(body.parts)
    ? body.parts.map((item) => {
        const row = item as Record<string, unknown>
        return {
          partId: String(row.partId ?? '').trim(),
          quantity: Number(String(row.quantity ?? '').replace(',', '.')),
          unitValue: Number(String(row.unitValue ?? '').replace(',', '.')),
        }
      })
    : []

  const payload: MaintenancePayload = {
    vehicleId: String(body.vehicleId ?? '').trim(),
    maintenanceType: String(body.maintenanceType ?? 'preventiva') as MaintenanceType,
    cause: String(body.cause ?? '').trim(),
    openedAt: String(body.openedAt ?? '').trim(),
    vehicleKm: Number(vehicleKmText),
    responsibleMechanicId: forcedMechanicId ?? String(body.responsibleMechanicId ?? '').trim(),
    status: String(body.status ?? 'aberta') as MaintenancePayload['status'],
    notes: normalizeOptionalText(body.notes),
    serviceIds: Array.isArray(body.serviceIds)
      ? [...new Set(body.serviceIds.map((id) => String(id).trim()).filter(Boolean))]
      : [],
    parts,
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
  if (!payload.serviceIds.length) throw new Error('Selecione pelo menos um serviço.')
  if (new Set(payload.parts.map((part) => part.partId)).size !== payload.parts.length) {
    throw new Error('A mesma peça não pode ser adicionada mais de uma vez.')
  }
  if (payload.parts.some((part) => (
    !part.partId
    || !Number.isFinite(part.quantity)
    || part.quantity <= 0
    || !Number.isFinite(part.unitValue)
    || part.unitValue < 0
  ))) {
    throw new Error('Informe peças com quantidade e valor válidos.')
  }
}

async function saveMaintenance(
  client: SupabaseClient,
  maintenanceId: string | null,
  payload: MaintenancePayload,
) {
  const { data, error } = await client.rpc('fn_salvar_manutencao', {
    p_manutencao_id: maintenanceId,
    p_veiculo_id: payload.vehicleId,
    p_tipo_manutencao: payload.maintenanceType,
    p_causa: payload.cause,
    p_aberto_em: payload.openedAt,
    p_km_veiculo: payload.vehicleKm,
    p_mecanico_responsavel_id: payload.responsibleMechanicId,
    p_status: payload.status,
    p_observacoes: payload.notes,
    p_servico_ids: payload.serviceIds,
    p_pecas: payload.parts,
  })
  if (error) throw error
  return String(data)
}

export function createMaintenance(
  client: SupabaseClient,
  payload: MaintenancePayload,
) {
  return saveMaintenance(client, null, payload)
}

export async function updateMaintenance(
  client: SupabaseClient,
  maintenanceId: string,
  payload: MaintenancePayload,
) {
  await saveMaintenance(client, maintenanceId, payload)
}

export async function cancelMaintenance(
  client: SupabaseClient,
  maintenanceId: string,
  reason: string,
) {
  const { error } = await client.rpc('fn_cancelar_manutencao', {
    p_manutencao_id: maintenanceId,
    p_motivo: reason,
  })
  if (error) throw error
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

  if (normalized.includes('estoque insuficiente')) {
    return NextResponse.json({ error: message }, { status: 409 })
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
