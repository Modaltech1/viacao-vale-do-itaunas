import { NextRequest, NextResponse } from 'next/server'
import { listExpenses } from '@/lib/expenses-repository'
import {
  expenseErrorResponse,
  expensePayloadToDatabase,
  parseExpensePayload,
} from '@/lib/expenses-service'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'
import { resolveTripRelation } from '@/lib/travel-operation-service'

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

  const service = createSupabaseServiceClient()

  try {
    const relation = await resolveTripRelation(service, payload.tripId)
    const { data, error } = await service
      .from('despesas_viagem')
      .insert({
        ...expensePayloadToDatabase(payload, relation),
        criado_por: auth.user.id,
        atualizado_por: auth.user.id,
      })
      .select('id')
      .single<{ id: string }>()

    if (error || !data) throw error ?? new Error('Não foi possível criar a despesa.')
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
  } catch (error) {
    return expenseErrorResponse(error, 'Não foi possível criar a despesa.')
  }
}
