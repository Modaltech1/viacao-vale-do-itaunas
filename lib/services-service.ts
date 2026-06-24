import 'server-only'

import { normalizeOptionalText } from '@/lib/driver-utils'
import { apiErrorResponse } from '@/lib/error-response'
import { parseKmValue } from '@/lib/km'
import type { MaintenanceType } from '@/types/fleet'
import {
  serviceCategories,
  type ServiceCategory,
  type ServicePeriodicityType,
} from '@/types/service'

const maintenanceTypes: MaintenanceType[] = ['preventiva', 'corretiva']
const periodicityTypes: ServicePeriodicityType[] = ['km', 'tempo', 'nenhuma']

export type ServicePayload = {
  name: string
  category: ServiceCategory
  suggestedMaintenanceType: MaintenanceType
  periodicityType: ServicePeriodicityType
  periodicityKm: number | null
  periodicityDays: number | null
  defaultValue: number
  description: string | null
  active: boolean
}

export function parseServicePayload(body: Record<string, unknown>): ServicePayload {
  const periodicityType = String(body.periodicityType ?? 'nenhuma') as ServicePeriodicityType
  const periodicityValueText = String(body.periodicityValue ?? '').replace(',', '.').trim()
  const periodicityValue = periodicityType === 'km'
    ? parseKmValue(body.periodicityValue, 'A periodicidade em KM')
    : periodicityValueText
      ? Number(periodicityValueText)
      : null
  const defaultValueText = String(body.defaultValue ?? '').replace(',', '.').trim()

  const payload: ServicePayload = {
    name: String(body.name ?? '').trim(),
    category: String(body.category ?? '') as ServiceCategory,
    suggestedMaintenanceType: String(
      body.suggestedMaintenanceType ?? 'preventiva',
    ) as MaintenanceType,
    periodicityType,
    periodicityKm: periodicityType === 'km' ? periodicityValue : null,
    periodicityDays: periodicityType === 'tempo' ? periodicityValue : null,
    defaultValue: Number(defaultValueText),
    description: normalizeOptionalText(body.description),
    active: body.active !== false,
  }

  validateServicePayload(payload)
  return payload
}

function validateServicePayload(payload: ServicePayload) {
  if (!payload.name) throw new Error('O nome do serviço é obrigatório.')

  if (!serviceCategories.includes(payload.category)) {
    throw new Error('Categoria de serviço inválida.')
  }

  if (!maintenanceTypes.includes(payload.suggestedMaintenanceType)) {
    throw new Error('Tipo de manutenção sugerido inválido.')
  }

  if (!periodicityTypes.includes(payload.periodicityType)) {
    throw new Error('Tipo de periodicidade inválido.')
  }

  if (!Number.isFinite(payload.defaultValue) || payload.defaultValue < 0) {
    throw new Error('Informe um valor padrão válido para o serviço.')
  }

  if (
    payload.periodicityType === 'km'
    && (payload.periodicityKm == null || !Number.isFinite(payload.periodicityKm) || payload.periodicityKm <= 0)
  ) {
    throw new Error('Informe uma periodicidade em KM maior que zero.')
  }

  if (
    payload.periodicityType === 'tempo'
    && (
      payload.periodicityDays == null
      || !Number.isInteger(payload.periodicityDays)
      || payload.periodicityDays <= 0
    )
  ) {
    throw new Error('Informe uma periodicidade em dias inteiros maior que zero.')
  }
}

export function servicePayloadToDatabase(payload: ServicePayload) {
  return {
    nome: payload.name,
    categoria: payload.category,
    tipo_manutencao_sugerido: payload.suggestedMaintenanceType,
    tipo_periodicidade: payload.periodicityType,
    periodicidade_km: payload.periodicityKm,
    periodicidade_dias: payload.periodicityDays,
    valor_padrao: payload.defaultValue,
    descricao: payload.description,
    ativo: payload.active,
  }
}

export function serviceErrorResponse(error: unknown, fallback: string, status = 400) {
  return apiErrorResponse(error, fallback, status, [
    {
      includes: ['servicos_categoria_check', 'servicos_periodicidade'],
      message: 'Revise a categoria e a periodicidade do serviço.',
      status: 400,
    },
  ])
}
