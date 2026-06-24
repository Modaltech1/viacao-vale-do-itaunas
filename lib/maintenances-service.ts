import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeOptionalText } from '@/lib/driver-utils'
import { apiErrorResponse } from '@/lib/error-response'
import { parseKmValue } from '@/lib/km'
import type { MaintenanceStatus, MaintenanceType } from '@/types/fleet'

const maintenanceTypes: MaintenanceType[] = ['preventiva', 'corretiva']
const editableStatuses = ['aberta', 'em_andamento', 'concluida'] as const

export type MaintenancePartPayload = {
  partId: string
  quantity: number
  unitValue: number
}

export type MaintenanceServicePayload = {
  serviceId: string
  appliedValue: number
}

export type MaintenancePayload = {
  vehicleId: string
  maintenanceType: MaintenanceType
  cause: string
  openedAt: string
  completedAt: string | null
  vehicleKm: number
  responsibleMechanicId: string
  status: (typeof editableStatuses)[number]
  notes: string | null
  services: MaintenanceServicePayload[]
  parts: MaintenancePartPayload[]
}

export function parseMaintenancePayload(
  body: Record<string, unknown>,
  forcedMechanicId?: string,
): MaintenancePayload {
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
  const services = Array.isArray(body.services)
    ? body.services.map((item) => {
        const row = item as Record<string, unknown>
        return {
          serviceId: String(row.serviceId ?? '').trim(),
          appliedValue: Number(String(row.appliedValue ?? '').replace(',', '.')),
        }
      })
    : []

  const payload: MaintenancePayload = {
    vehicleId: String(body.vehicleId ?? '').trim(),
    maintenanceType: String(body.maintenanceType ?? 'preventiva') as MaintenanceType,
    cause: String(body.cause ?? '').trim(),
    openedAt: String(body.openedAt ?? '').trim(),
    completedAt: normalizeOptionalText(body.completedAt),
    vehicleKm: parseKmValue(body.vehicleKm, 'O KM do veículo'),
    responsibleMechanicId: forcedMechanicId ?? String(body.responsibleMechanicId ?? '').trim(),
    status: String(body.status ?? 'aberta') as MaintenancePayload['status'],
    notes: normalizeOptionalText(body.notes),
    services,
    parts,
  }

  validateMaintenancePayload(payload)
  return payload
}

export function parseRemoveMaintenancePayload(body: Record<string, unknown>) {
  const reason = String(body.reason ?? '').trim()
  if (reason.length < 5) {
    throw new Error('Informe um motivo com pelo menos 5 caracteres para remover a manutenção.')
  }

  return { reason }
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
  if (payload.status === 'concluida') {
    if (!payload.completedAt || Number.isNaN(new Date(payload.completedAt).getTime())) {
      throw new Error('Informe uma data de conclusão válida.')
    }
    if (new Date(payload.completedAt).getTime() < new Date(payload.openedAt).getTime()) {
      throw new Error('A data de conclusão não pode ser anterior à abertura.')
    }
    if (new Date(payload.completedAt).getTime() > Date.now()) {
      throw new Error('A data de conclusão não pode estar no futuro.')
    }
  } else if (payload.completedAt) {
    throw new Error('A data de conclusão só pode ser informada em uma manutenção concluída.')
  }
  if (!Number.isFinite(payload.vehicleKm) || payload.vehicleKm < 0) {
    throw new Error('Informe uma quilometragem válida.')
  }
  if (!payload.responsibleMechanicId) throw new Error('Selecione o mecânico responsável.')
  if (!editableStatuses.includes(payload.status)) throw new Error('Status de manutenção inválido.')
  if (!payload.services.length) throw new Error('Selecione pelo menos um serviço.')
  if (new Set(payload.services.map((service) => service.serviceId)).size !== payload.services.length) {
    throw new Error('O mesmo serviço não pode ser adicionado mais de uma vez.')
  }
  if (payload.services.some((service) => (
    !service.serviceId
    || !Number.isFinite(service.appliedValue)
    || service.appliedValue < 0
  ))) {
    throw new Error('Informe serviços com valores válidos.')
  }
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
  const parameters = {
    p_veiculo_id: payload.vehicleId,
    p_tipo_manutencao: payload.maintenanceType,
    p_causa: payload.cause,
    p_aberto_em: payload.openedAt,
    p_km_veiculo: payload.vehicleKm,
    p_mecanico_responsavel_id: payload.responsibleMechanicId,
    p_status: payload.status,
    p_observacoes: payload.notes,
    p_servicos: payload.services,
    p_pecas: payload.parts,
  }
  const functionName = payload.status === 'concluida'
    ? maintenanceId
      ? 'fn_editar_manutencao_concluida'
      : 'fn_criar_manutencao_concluida'
    : 'fn_salvar_manutencao'
  const { data, error } = await client.rpc(
    functionName,
    payload.status === 'concluida'
      ? {
          ...parameters,
          ...(maintenanceId ? { p_manutencao_id: maintenanceId } : {}),
          p_concluido_em: payload.completedAt,
        }
      : { ...parameters, p_manutencao_id: maintenanceId },
  )
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

export async function removeMaintenance(
  client: SupabaseClient,
  maintenanceId: string,
  reason: string,
) {
  const { data, error } = await client.rpc('fn_remover_manutencao', {
    p_manutencao_id: maintenanceId,
    p_motivo: reason,
  })

  if (error) throw error
  return data
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
  return apiErrorResponse(error, fallback, status, [
    {
      includes: ['duplicate'],
      message: 'Este item já foi adicionado nesta manutenção.',
      status: 409,
    },
  ])
}

export function isMaintenanceEditable(status: MaintenanceStatus) {
  return status === 'aberta' || status === 'em_andamento'
}
