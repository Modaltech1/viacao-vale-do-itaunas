import { NextRequest, NextResponse } from 'next/server'
import {
  driverPortalErrorResponse,
  parseRefuelingPayload,
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
    payload = parseRefuelingPayload(await request.json())
  } catch (error) {
    return driverPortalErrorResponse(error, 'Dados do abastecimento inválidos.')
  }

  try {
    const { data, error } = await auth.supabase.rpc('fn_registrar_abastecimento', {
      p_viagem_id: id,
      p_km_registrado: payload.registeredKm,
      p_tipo_combustivel: payload.fuelType,
      p_litros: payload.liters,
      p_observacoes: payload.notes,
    })

    if (error) throw error
    return NextResponse.json({ ok: true, id: data }, { status: 201 })
  } catch (error) {
    return driverPortalErrorResponse(error, 'Não foi possível registrar o abastecimento.')
  }
}
