import { NextRequest, NextResponse } from 'next/server'
import {
  parseRefuelingPayload,
  refuelingErrorResponse,
  refuelingPayloadToDatabase,
} from '@/lib/refuelings-service'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  let payload
  try {
    payload = parseRefuelingPayload(await request.json())
  } catch (error) {
    return refuelingErrorResponse(error, 'Dados do abastecimento inválidos.')
  }

  const service = createSupabaseServiceClient()

  try {
    const { data: current, error: currentError } = await service
      .from('abastecimentos')
      .select('id,viagem_id,veiculo_id,motorista_id')
      .eq('id', id)
      .is('cancelado_em', null)
      .single<{
        id: string
        viagem_id: string | null
        veiculo_id: string
        motorista_id: string | null
      }>()

    if (currentError || !current) {
      return NextResponse.json({ error: 'Abastecimento não encontrado.' }, { status: 404 })
    }

    let relation
    if (payload.tripId) {
      const { data: trip, error: tripError } = await service
        .from('viagens')
        .select('veiculo_id,motorista_id')
        .eq('id', payload.tripId)
        .neq('status', 'cancelada')
        .single<{ veiculo_id: string; motorista_id: string }>()

      if (tripError || !trip) throw new Error('Viagem não encontrada.')
      relation = { vehicleId: trip.veiculo_id, driverId: trip.motorista_id }
    }

    const { error } = await service
      .from('abastecimentos')
      .update({
        ...refuelingPayloadToDatabase(payload, relation),
        atualizado_por: auth.user.id,
      })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return refuelingErrorResponse(error, 'Não foi possível atualizar o abastecimento.')
  }
}
