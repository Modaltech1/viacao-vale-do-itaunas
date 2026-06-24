import 'server-only'

import { normalizeOptionalText } from '@/lib/driver-utils'
import { apiErrorResponse } from '@/lib/error-response'
import { parseKmValue } from '@/lib/km'

const fuelTypes = ['Diesel S10', 'Diesel S500', 'ARLA', 'Gasolina', 'Etanol'] as const
const expenseCategories = ['Pedágio', 'Alimentação', 'Hospedagem', 'Descarga', 'Outros'] as const

function positiveNumber(value: unknown, label: string) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} deve ser maior que zero.`)
  return parsed
}

export function parseStartTripPayload(body: Record<string, unknown>) {
  const payload = {
    vehicleId: String(body.vehicleId ?? '').trim(),
    origin: String(body.origin ?? '').trim(),
    destination: String(body.destination ?? '').trim(),
    initialKm: parseKmValue(body.initialKm, 'O KM inicial'),
    notes: normalizeOptionalText(body.notes),
  }

  if (!payload.vehicleId || !payload.origin || !payload.destination) {
    throw new Error('Veículo, origem e destino são obrigatórios.')
  }

  return payload
}

export function parseRefuelingPayload(body: Record<string, unknown>) {
  const fuelType = String(body.fuelType ?? '') as (typeof fuelTypes)[number]
  if (!fuelTypes.includes(fuelType)) throw new Error('Tipo de combustível inválido.')

  return {
    registeredKm: parseKmValue(body.registeredKm, 'O KM registrado'),
    fuelType,
    liters: positiveNumber(body.liters, 'A quantidade de litros'),
    notes: normalizeOptionalText(body.notes),
  }
}

export function parseExpensePayload(body: Record<string, unknown>) {
  const category = String(body.category ?? '') as (typeof expenseCategories)[number]
  if (!expenseCategories.includes(category)) throw new Error('Categoria de despesa inválida.')

  return {
    category,
    value: positiveNumber(body.value, 'O valor'),
    notes: normalizeOptionalText(body.notes),
  }
}

export function parseEndTripPayload(body: Record<string, unknown>) {
  return {
    finalKm: parseKmValue(body.finalKm, 'O KM final'),
    notes: normalizeOptionalText(body.notes),
  }
}

export function driverPortalErrorResponse(error: unknown, fallback: string, status = 400) {
  return apiErrorResponse(error, fallback, status)
}
