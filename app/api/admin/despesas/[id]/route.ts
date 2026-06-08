import { NextRequest, NextResponse } from 'next/server'
import {
  expenseErrorResponse,
  parseExpensePayload,
  saveExpense,
} from '@/lib/expenses-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  let payload
  try {
    payload = parseExpensePayload(await request.json())
  } catch (error) {
    return expenseErrorResponse(error, 'Dados da despesa inválidos.')
  }

  try {
    await saveExpense(auth.supabase, id, payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return expenseErrorResponse(error, 'Não foi possível atualizar a despesa.')
  }
}
