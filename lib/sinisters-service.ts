import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { apiErrorResponse } from '@/lib/error-response'
import { normalizeOptionalText } from '@/lib/driver-utils'
import {
  sinisterCostCategories,
  sinisterStatuses,
  sinisterTypes,
  type SinisterCostCategory,
  type SinisterStatus,
  type SinisterType,
} from '@/types/sinister'
import type { Severity } from '@/types/fleet'

const severities: Severity[] = ['baixa', 'atencao', 'critica']

export function parseSinisterPayload(body: Record<string, unknown>) {
  const vehicleId = String(body.vehicleId ?? '').trim()
  if (!vehicleId) throw new Error('Selecione o veículo do sinistro.')

  const occurredAt = new Date(String(body.occurredAt ?? ''))
  if (Number.isNaN(occurredAt.getTime())) throw new Error('Data do sinistro inválida.')

  const type = String(body.type ?? '') as SinisterType
  if (!sinisterTypes.includes(type)) throw new Error('Tipo de sinistro inválido.')

  const severity = String(body.severity ?? '') as Severity
  if (!severities.includes(severity)) throw new Error('Severidade do sinistro inválida.')

  const status = String(body.status ?? '') as SinisterStatus
  if (!sinisterStatuses.includes(status)) throw new Error('Status do sinistro inválido.')

  const description = String(body.description ?? '').trim()
  if (!description) throw new Error('Descreva o sinistro.')

  const costs = Array.isArray(body.costs)
    ? body.costs.map((item) => {
        const row = item as Record<string, unknown>
        return {
          category: String(row.category ?? 'outros') as SinisterCostCategory,
          description: String(row.description ?? '').trim(),
          quantity: Number(String(row.quantity ?? '').replace(',', '.')),
          unitValue: Number(String(row.unitValue ?? '').replace(',', '.')),
          receiptPath: normalizeOptionalText(row.receiptPath),
        }
      })
    : []

  if (costs.some((cost) => !sinisterCostCategories.includes(cost.category))) {
    throw new Error('Categoria de custo do sinistro inválida.')
  }
  if (costs.some((cost) => !cost.description)) {
    throw new Error('Descreva todos os custos do sinistro.')
  }
  if (costs.some((cost) => (
    !Number.isFinite(cost.quantity)
    || cost.quantity <= 0
    || !Number.isFinite(cost.unitValue)
    || cost.unitValue < 0
  ))) {
    throw new Error('Informe custos com quantidade e valor válidos.')
  }

  return {
    vehicleId,
    driverId: normalizeOptionalText(body.driverId),
    occurredAt: occurredAt.toISOString(),
    type,
    severity,
    status,
    location: normalizeOptionalText(body.location),
    description,
    notes: normalizeOptionalText(body.notes),
    policeReport: normalizeOptionalText(body.policeReport),
    hasThirdParties: Boolean(body.hasThirdParties),
    costs,
  }
}

export async function saveSinister(
  client: SupabaseClient,
  sinisterId: string | null,
  payload: ReturnType<typeof parseSinisterPayload>,
) {
  const { data, error } = await client.rpc('fn_salvar_sinistro', {
    p_sinistro_id: sinisterId,
    p_veiculo_id: payload.vehicleId,
    p_motorista_id: payload.driverId,
    p_data_ocorrencia: payload.occurredAt,
    p_tipo: payload.type,
    p_severidade: payload.severity,
    p_status: payload.status,
    p_local_ocorrencia: payload.location,
    p_descricao: payload.description,
    p_observacoes: payload.notes,
    p_boletim_ocorrencia: payload.policeReport,
    p_terceiros_envolvidos: payload.hasThirdParties,
    p_custos: payload.costs,
  })
  if (error) throw error
  return String(data)
}

export function sinisterErrorResponse(error: unknown, fallback: string, status = 400) {
  return apiErrorResponse(error, fallback, status, [
    {
      includes: ['sinistros_operacionais_tipo_check', 'tipo de sinistro invalido'],
      message: 'Selecione um tipo válido para o sinistro.',
      status: 400,
    },
    {
      includes: ['sinistros_operacionais_status_check', 'status do sinistro invalido'],
      message: 'Selecione um status válido para o sinistro.',
      status: 400,
    },
    {
      includes: ['sinistros_operacionais_descricao_check', 'descricao do sinistro'],
      message: 'Descreva o sinistro antes de salvar.',
      status: 400,
    },
    {
      includes: ['sinistro_custos', 'custo do sinistro'],
      message: 'Confira os itens de custo do sinistro.',
      status: 400,
    },
  ])
}
