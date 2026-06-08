import { NextRequest, NextResponse } from 'next/server'
import { listExpenses } from '@/lib/expenses-repository'
import {
  expenseErrorResponse,
  parseExpensePayload,
  saveExpense,
} from '@/lib/expenses-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(await listExpenses(auth.supabase))
  } catch (error) {
    return expenseErrorResponse(error, 'Não foi possível carregar as despesas.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let payload
  try {
    payload = parseExpensePayload(await request.json())
  } catch (error) {
    return expenseErrorResponse(error, 'Dados da despesa inválidos.')
  }

  try {
    const id = await saveExpense(auth.supabase, null, payload)
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return expenseErrorResponse(error, 'Não foi possível criar a despesa.')
  }
}
