import { NextRequest, NextResponse } from 'next/server'
import {
  driverPortalErrorResponse,
  parseEndTripPayload,
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
    payload = parseEndTripPayload(await request.json())
  } catch (error) {
    return driverPortalErrorResponse(error, 'Dados de encerramento inválidos.')
  }

  try {
    const { error } = await auth.supabase.rpc('fn_concluir_viagem', {
      p_viagem_id: id,
      p_km_final: payload.finalKm,
      p_chegou_em: new Date().toISOString(),
      p_observacoes: payload.notes,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return driverPortalErrorResponse(error, 'Não foi possível encerrar a viagem.')
  }
}
