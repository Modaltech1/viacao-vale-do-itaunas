import 'server-only'

import { NextResponse } from 'next/server'
import { normalizeOptionalText } from '@/lib/driver-utils'
import { parseKmValue, parseOptionalKmValue } from '@/lib/km'

function requiredDate(value: unknown, label: string) {
  const rawValue = String(value ?? '').trim()
  if (!rawValue) throw new Error(`${label} inválida.`)

  const date = new Date(rawValue)
  if (Number.isNaN(date.getTime())) throw new Error(`${label} inválida.`)
  return date.toISOString()
}

function optionalDate(value: unknown, label: string) {
  if (String(value ?? '').trim() === '') return null
  return requiredDate(value, label)
}

export function parseCreateTripPayload(body: Record<string, unknown>) {
  const payload = {
    driverId: String(body.driverId ?? '').trim(),
    vehicleId: String(body.vehicleId ?? '').trim(),
    origin: String(body.origin ?? '').trim(),
    destination: String(body.destination ?? '').trim(),
    startedAt: requiredDate(body.startedAt, 'Data de saída'),
    initialKm: parseKmValue(body.initialKm, 'O KM inicial'),
    notes: normalizeOptionalText(body.notes),
  }

  if (!payload.driverId || !payload.vehicleId || !payload.origin || !payload.destination) {
    throw new Error('Motorista, veículo, origem e destino são obrigatórios.')
  }
  return payload
}

export function parseUpdateTripPayload(body: Record<string, unknown>) {
  const origin = String(body.origin ?? '').trim()
  const destination = String(body.destination ?? '').trim()
  if (!origin || !destination) throw new Error('Origem e destino são obrigatórios.')

  return {
    origin,
    destination,
    finishedAt: optionalDate(body.finishedAt, 'Data de chegada'),
    finalKm: parseOptionalKmValue(body.finalKm, 'O KM final'),
    notes: normalizeOptionalText(body.notes),
  }
}

export function parseConcludeTripPayload(body: Record<string, unknown>) {
  return {
    finishedAt: requiredDate(body.finishedAt, 'Data de chegada'),
    finalKm: parseKmValue(body.finalKm, 'O KM final'),
    notes: normalizeOptionalText(body.notes),
  }
}

export function parseRemoveTripPayload(body: Record<string, unknown>) {
  const reason = String(body.reason ?? '').trim()
  if (reason.length < 5) {
    throw new Error('Informe um motivo com pelo menos 5 caracteres para remover a viagem.')
  }

  return { reason }
}

export function tripErrorResponse(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback
  const normalized = message.toLowerCase()
  const explicitStatus =
    typeof error === 'object'
    && error !== null
    && 'status' in error
    && typeof error.status === 'number'
      ? error.status
      : null

  if (normalized.includes('invalid api key')) {
    return NextResponse.json(
      { error: 'A configuração server-side do Supabase está inválida.' },
      { status: 500 },
    )
  }

  if (
    normalized.includes('já possui viagem')
    || normalized.includes('duplicate key')
  ) {
    return NextResponse.json(
      { error: 'O motorista ou o veículo já possui uma viagem em andamento.' },
      { status: 409 },
    )
  }

  return NextResponse.json({ error: message || fallback }, { status: explicitStatus ?? status })
}
