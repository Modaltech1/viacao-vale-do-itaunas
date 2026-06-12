import { NextRequest, NextResponse } from 'next/server'
import { listRefuelings } from '@/lib/refuelings-repository'
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

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(await listRefuelings(auth.supabase))
  } catch (error) {
    return refuelingErrorResponse(error, 'Não foi possível carregar os abastecimentos.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let payload
  try {
    payload = parseRefuelingPayload(await request.json())
  } catch (error) {
    return refuelingErrorResponse(error, 'Dados do abastecimento inválidos.')
  }

  const service = createSupabaseServiceClient()

  try {
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

    const { data, error } = await service
      .from('abastecimentos')
      .insert({
        ...refuelingPayloadToDatabase(payload, relation),
        criado_por: auth.user.id,
        atualizado_por: auth.user.id,
      })
      .select('id')
      .single<{ id: string }>()

    if (error || !data) throw error ?? new Error('Não foi possível criar o abastecimento.')
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
  } catch (error) {
    return refuelingErrorResponse(error, 'Não foi possível criar o abastecimento.')
  }
}
