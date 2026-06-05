import { NextRequest, NextResponse } from 'next/server'
import {
  driverPortalErrorResponse,
  parseExpensePayload,
} from '@/lib/driver-portal-service'
import { requireDriver } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireDriver()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  let payload
  try {
    payload = parseExpensePayload(await request.json())
  } catch (error) {
    return driverPortalErrorResponse(error, 'Dados da despesa inválidos.')
  }

  try {
    const { data, error } = await auth.supabase.rpc('fn_registrar_despesa_viagem', {
      p_viagem_id: id,
      p_categoria: payload.category,
      p_valor: payload.value,
      p_observacoes: payload.notes,
      p_comprovante_path: null,
    })

    if (error) throw error
    return NextResponse.json({ ok: true, id: data }, { status: 201 })
  } catch (error) {
    return driverPortalErrorResponse(error, 'Não foi possível registrar a despesa.')
  }
}
