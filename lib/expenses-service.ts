import 'server-only'

import { NextResponse } from 'next/server'
import { normalizeOptionalText } from '@/lib/driver-utils'
import { expenseCategories, type ExpenseCategory } from '@/types/expense'

export function parseExpensePayload(body: Record<string, unknown>) {
  const category = String(body.category ?? '') as ExpenseCategory
  if (!expenseCategories.includes(category)) throw new Error('Categoria de despesa inválida.')

  const value = Number(String(body.value ?? '').replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('O valor da despesa deve ser maior que zero.')
  }

  const registeredAt = new Date(String(body.registeredAt ?? ''))
  if (Number.isNaN(registeredAt.getTime())) throw new Error('Data da despesa inválida.')

  const payload = {
    tripId: normalizeOptionalText(body.tripId),
    vehicleId: String(body.vehicleId ?? '').trim(),
    driverId: normalizeOptionalText(body.driverId),
    category,
    value,
    registeredAt: registeredAt.toISOString(),
    notes: normalizeOptionalText(body.notes),
    receiptPath: normalizeOptionalText(body.receiptPath),
  }

  if (!payload.vehicleId) throw new Error('O veículo é obrigatório.')
  return payload
}

export function expensePayloadToDatabase(
  payload: ReturnType<typeof parseExpensePayload>,
  relation?: { vehicleId: string; driverId: string | null },
) {
  return {
    viagem_id: payload.tripId,
    veiculo_id: relation?.vehicleId ?? payload.vehicleId,
    motorista_id: relation?.driverId ?? payload.driverId,
    categoria: payload.category,
    valor: payload.value,
    registrado_em: payload.registeredAt,
    observacoes: payload.notes,
    comprovante_path: payload.receiptPath,
  }
}

export function expenseErrorResponse(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid api key')) {
    return NextResponse.json(
      { error: 'A configuração server-side do Supabase está inválida.' },
      { status: 500 },
    )
  }

  if (normalized.includes('incompatível com motorista/veículo')) {
    return NextResponse.json(
      { error: 'O motorista e o veículo precisam corresponder à viagem selecionada.' },
      { status: 400 },
    )
  }

  if (normalized.includes('violates check constraint')) {
    return NextResponse.json(
      { error: 'A categoria ou o valor da despesa não respeita as regras do sistema.' },
      { status: 400 },
    )
  }

  return NextResponse.json({ error: message || fallback }, { status })
}
