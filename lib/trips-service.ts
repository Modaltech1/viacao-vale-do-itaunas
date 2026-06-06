import 'server-only'

import { NextResponse } from 'next/server'
import { normalizeOptionalText } from '@/lib/driver-utils'

function nonNegativeNumber(value: unknown, label: string) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} deve ser maior ou igual a zero.`)
  }
  return parsed
}

function requiredDate(value: unknown, label: string) {
  const date = new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) throw new Error(`${label} inválida.`)
  return date.toISOString()
}

export function parseCreateTripPayload(body: Record<string, unknown>) {
  const payload = {
    driverId: String(body.driverId ?? '').trim(),
    vehicleId: String(body.vehicleId ?? '').trim(),
    origin: String(body.origin ?? '').trim(),
    destination: String(body.destination ?? '').trim(),
    startedAt: requiredDate(body.startedAt, 'Data de saída'),
    initialKm: nonNegativeNumber(body.initialKm, 'O KM inicial'),
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
    notes: normalizeOptionalText(body.notes),
  }
}

export function parseConcludeTripPayload(body: Record<string, unknown>) {
  return {
    finishedAt: requiredDate(body.finishedAt, 'Data de chegada'),
    finalKm: nonNegativeNumber(body.finalKm, 'O KM final'),
    notes: normalizeOptionalText(body.notes),
  }
}

export function tripErrorResponse(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback
  const normalized = message.toLowerCase()

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

  return NextResponse.json({ error: message || fallback }, { status })
}
