import { NextRequest, NextResponse } from 'next/server'
import { listVehicleFormOptions, listVehicles } from '@/lib/vehicles-repository'
import {
  createVehicleDocuments,
  createVehicleRoute,
  parseVehiclePayload,
  syncVehicleDrivers,
  vehicleErrorResponse,
} from '@/lib/vehicles-service'
import { resolveAdminOwnerId } from '@/lib/admin-scope'
import { assertAdminDriverAccess } from '@/lib/admin-scope-server'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const [items, options] = await Promise.all([
      listVehicles(auth.supabase),
      listVehicleFormOptions(auth.supabase),
    ])

    return NextResponse.json({ items, options })
  } catch (error) {
    return vehicleErrorResponse(error, 'Não foi possível carregar os veículos.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let payload
  try {
    payload = parseVehiclePayload(await request.json())
  } catch (error) {
    return vehicleErrorResponse(error, 'Dados do veículo inválidos.')
  }

  const service = createSupabaseServiceClient()
  let vehicleId: string | null = null
  let createdRouteId: string | null = null

  try {
    await Promise.all(
      payload.driverIds.map((driverId) =>
        assertAdminDriverAccess(auth.supabase, auth.admin, driverId),
      ),
    )

    const route = await createVehicleRoute(service, payload, auth.user.id)
    createdRouteId = route.createdRouteId

    const { data: vehicle, error: vehicleError } = await service
      .from('veiculos')
      .insert({
        tipo: payload.type,
        marca: payload.brand,
        modelo: payload.model,
        codigo_frota: payload.fleetCode,
        placa: payload.plate,
        ano: payload.year,
        status_operacional: payload.status,
        km_atual: payload.currentKm,
        capacidade: payload.capacity,
        rota_fixa_id: route.routeId,
        observacoes: payload.notes,
        admin_responsavel_id: resolveAdminOwnerId(auth.admin),
        criado_por: auth.user.id,
        atualizado_por: auth.user.id,
      })
      .select('id')
      .single<{ id: string }>()

    if (vehicleError || !vehicle) {
      throw vehicleError ?? new Error('Não foi possível criar o veículo.')
    }

    vehicleId = vehicle.id
    await createVehicleDocuments(service, vehicleId, payload.documentDates, auth.user.id)
    await syncVehicleDrivers(
      service,
      vehicleId,
      payload.driverIds,
      payload.principalDriverId,
      auth.user.id,
    )

    return NextResponse.json({ ok: true, id: vehicleId }, { status: 201 })
  } catch (error) {
    if (vehicleId) {
      await service.from('veiculo_motoristas').delete().eq('veiculo_id', vehicleId)
      await service.from('veiculo_documentos').delete().eq('veiculo_id', vehicleId)
      await service.from('veiculos').delete().eq('id', vehicleId)
    }
    if (createdRouteId) await service.from('rotas').delete().eq('id', createdRouteId)

    return vehicleErrorResponse(error, 'Não foi possível criar o veículo.')
  }
}
