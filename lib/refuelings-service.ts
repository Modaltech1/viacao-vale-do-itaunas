import 'server-only'

import { normalizeOptionalText } from '@/lib/driver-utils'
import { apiErrorResponse } from '@/lib/error-response'
import { parseKmValue } from '@/lib/km'
import { fuelTypes, type FuelType } from '@/types/refueling'

function optionalNonNegativeNumber(value: unknown, label: string) {
  const text = String(value ?? '').replace(',', '.').trim()
  if (!text) return null

  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} deve ser maior ou igual a zero.`)
  }
  return parsed
}

function positiveNumber(value: unknown, label: string) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} deve ser maior que zero.`)
  }
  return parsed
}

export function parseRefuelingPayload(body: Record<string, unknown>) {
  const fuelType = String(body.fuelType ?? '') as FuelType
  if (!fuelTypes.includes(fuelType)) throw new Error('Tipo de combustível inválido.')

  const registeredAt = new Date(String(body.registeredAt ?? ''))
  if (Number.isNaN(registeredAt.getTime())) throw new Error('Data do abastecimento inválida.')

  const payload = {
    tripId: normalizeOptionalText(body.tripId),
    vehicleId: String(body.vehicleId ?? '').trim(),
    driverId: normalizeOptionalText(body.driverId),
    registeredAt: registeredAt.toISOString(),
    registeredKm: parseKmValue(body.registeredKm, 'O KM registrado'),
    fuelType,
    liters: positiveNumber(body.liters, 'A quantidade de litros'),
    unitValue: optionalNonNegativeNumber(body.unitValue, 'O valor unitário'),
    totalValue: optionalNonNegativeNumber(body.totalValue, 'O valor total'),
    notes: normalizeOptionalText(body.notes),
  }

  if (!payload.vehicleId) throw new Error('O veículo é obrigatório.')
  return payload
}

export function refuelingPayloadToDatabase(
  payload: ReturnType<typeof parseRefuelingPayload>,
  relation?: { vehicleId: string; driverId: string | null },
) {
  const totalValue = payload.totalValue
    ?? (payload.unitValue == null
      ? null
      : Math.round(payload.liters * payload.unitValue * 100) / 100)

  return {
    viagem_id: payload.tripId,
    veiculo_id: relation?.vehicleId ?? payload.vehicleId,
    motorista_id: relation?.driverId ?? payload.driverId,
    registrado_em: payload.registeredAt,
    km_registrado: payload.registeredKm,
    tipo_combustivel: payload.fuelType,
    litros: payload.liters,
    valor_unitario: payload.unitValue,
    valor_total: totalValue,
    observacoes: payload.notes,
  }
}

export function refuelingErrorResponse(error: unknown, fallback: string, status = 400) {
  return apiErrorResponse(error, fallback, status, [
    {
      includes: ['incompatível com motorista/veículo', 'incompativel com motorista/veiculo'],
      message: 'O motorista e o veículo precisam corresponder à viagem selecionada.',
      status: 400,
    },
    {
      includes: ['abastecimentos_km_check', 'abastecimentos_litros_check', 'abastecimentos_valores_check'],
      message: 'Revise o KM, os litros e os valores do abastecimento.',
      status: 400,
    },
  ])
}
