import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { apiErrorResponse } from '@/lib/error-response'
import { normalizeOptionalText } from '@/lib/driver-utils'
import { expenseCategories, type ExpenseCategory } from '@/types/expense'

export function parseExpensePayload(body: Record<string, unknown>) {
  const category = String(body.category ?? '') as ExpenseCategory
  if (!expenseCategories.includes(category)) throw new Error('Categoria de despesa inválida.')

  const value = Number(String(body.value ?? '').replace(',', '.'))
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

  if (category !== 'Peças' && (!Number.isFinite(value) || value <= 0)) {
    throw new Error('O valor da despesa deve ser maior que zero.')
  }
  if (category === 'Peças' && !parts.length) {
    throw new Error('Adicione pelo menos uma peça à despesa.')
  }
  if (category !== 'Peças' && parts.length) {
    throw new Error('Peças só podem ser informadas na categoria Peças.')
  }
  if (new Set(parts.map((part) => part.partId)).size !== parts.length) {
    throw new Error('A mesma peça não pode ser adicionada mais de uma vez.')
  }
  if (parts.some((part) => (
    !part.partId
    || !Number.isFinite(part.quantity)
    || part.quantity <= 0
    || !Number.isFinite(part.unitValue)
    || part.unitValue < 0
  ))) {
    throw new Error('Informe peças com quantidade e valor válidos.')
  }
  if (
    category === 'Peças'
    && parts.reduce((total, part) => total + part.quantity * part.unitValue, 0) <= 0
  ) {
    throw new Error('O valor total das peças deve ser maior que zero.')
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
    parts,
  }

  if (!payload.vehicleId) throw new Error('O veículo é obrigatório.')
  return payload
}

export async function saveExpense(
  client: SupabaseClient,
  expenseId: string | null,
  payload: ReturnType<typeof parseExpensePayload>,
) {
  const { data, error } = await client.rpc('fn_salvar_despesa', {
    p_despesa_id: expenseId,
    p_viagem_id: payload.tripId,
    p_veiculo_id: payload.vehicleId,
    p_motorista_id: payload.driverId,
    p_categoria: payload.category,
    p_valor: payload.category === 'Peças' ? 0 : payload.value,
    p_registrado_em: payload.registeredAt,
    p_observacoes: payload.notes,
    p_comprovante_path: payload.receiptPath,
    p_pecas: payload.parts,
  })
  if (error) throw error
  return String(data)
}

export function expenseErrorResponse(error: unknown, fallback: string, status = 400) {
  return apiErrorResponse(error, fallback, status, [
    {
      includes: ['incompatível com motorista/veículo', 'incompativel com motorista/veiculo'],
      message: 'O motorista e o veículo precisam corresponder à viagem selecionada.',
      status: 400,
    },
    {
      includes: ['despesas_viagem_categoria_check'],
      message: 'A categoria da despesa não é válida para este lançamento.',
      status: 400,
    },
  ])
}
