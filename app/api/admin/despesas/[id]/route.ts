import { NextRequest, NextResponse } from 'next/server'
import {
  expenseErrorResponse,
  expensePayloadToDatabase,
  parseExpensePayload,
} from '@/lib/expenses-service'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'
import { resolveTripRelation } from '@/lib/travel-operation-service'

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

  const service = createSupabaseServiceClient()

  try {
    const { data: current, error: currentError } = await service
      .from('despesas_viagem')
      .select('id')
      .eq('id', id)
      .is('cancelado_em', null)
      .single<{ id: string }>()

    if (currentError || !current) {
      return NextResponse.json({ error: 'Despesa não encontrada.' }, { status: 404 })
    }

    const relation = await resolveTripRelation(service, payload.tripId)
    const { error } = await service
      .from('despesas_viagem')
      .update({
        ...expensePayloadToDatabase(payload, relation),
        atualizado_por: auth.user.id,
      })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return expenseErrorResponse(error, 'Não foi possível atualizar a despesa.')
  }
}
