import { NextRequest, NextResponse } from 'next/server'
import {
  parseRefuelingPayload,
  refuelingErrorResponse,
  refuelingPayloadToDatabase,
} from '@/lib/refuelings-service'
import {
  assertAdminDriverAccess,
  assertAdminTripAccess,
  assertAdminVehicleAccess,
} from '@/lib/admin-scope-server'
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

    await assertAdminVehicleAccess(auth.supabase, auth.admin, current.veiculo_id)
    if (payload.tripId) {
      await assertAdminTripAccess(auth.supabase, auth.admin, payload.tripId)
    }

    const relation = await resolveTripRelation(service, payload.tripId)
    await assertAdminVehicleAccess(
      auth.supabase,
      auth.admin,
      relation?.vehicleId ?? payload.vehicleId,
    )
    const effectiveDriverId = relation?.driverId ?? payload.driverId
    if (effectiveDriverId) {
      await assertAdminDriverAccess(auth.supabase, auth.admin, effectiveDriverId)
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
