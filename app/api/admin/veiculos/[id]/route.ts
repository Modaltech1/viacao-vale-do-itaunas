import { NextRequest, NextResponse } from 'next/server'
import { getVehicleDetails, listVehicleFormOptions } from '@/lib/vehicles-repository'
import {
  createVehicleRoute,
  parseVehiclePayload,
  renewChangedVehicleDocuments,
  syncVehicleDrivers,
  vehicleErrorResponse,
} from '@/lib/vehicles-service'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  try {
    const [vehicle, options] = await Promise.all([
      getVehicleDetails(auth.supabase, id),
      listVehicleFormOptions(auth.supabase),
    ])

    if (!vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ vehicle, options })
  } catch (error) {
    return vehicleErrorResponse(error, 'Não foi possível carregar o veículo.', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const body = await request.json()
  const service = createSupabaseServiceClient()

  if (body.section === 'drivers') {
    const driverIds: string[] = Array.isArray(body.driverIds)
      ? [...new Set<string>(
          body.driverIds
            .map((driverId: unknown) => String(driverId).trim())
            .filter((driverId: string) => Boolean(driverId)),
        )]
      : []
    const principalDriverId = String(body.principalDriverId ?? '').trim() || null

    try {
      const { data: vehicle, error } = await service
        .from('veiculos')
        .select('id')
        .eq('id', id)
        .is('excluido_em', null)
        .single()

      if (error || !vehicle) {
        return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
      }

      await syncVehicleDrivers(service, id, driverIds, principalDriverId, auth.user.id)
      return NextResponse.json({ ok: true })
    } catch (error) {
      return vehicleErrorResponse(error, 'Não foi possível atualizar os motoristas do veículo.')
    }
  }

  let payload
  try {
    payload = parseVehiclePayload(body)
  } catch (error) {
    return vehicleErrorResponse(error, 'Dados do veículo inválidos.')
  }

  let createdRouteId: string | null = null

  try {
    const { data: currentVehicle, error: currentError } = await service
      .from('veiculos')
      .select('tipo,marca,modelo,placa,ano,status_operacional,km_atual,capacidade,rota_fixa_id,observacoes')
      .eq('id', id)
      .is('excluido_em', null)
      .single()

    if (currentError || !currentVehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
    }

    const route = await createVehicleRoute(service, payload, auth.user.id)
    createdRouteId = route.createdRouteId

    const { error: updateError } = await service
      .from('veiculos')
      .update({
        tipo: payload.type,
        marca: payload.brand,
        modelo: payload.model,
        placa: payload.plate,
        ano: payload.year,
        status_operacional: payload.status,
        km_atual: payload.currentKm,
        capacidade: payload.capacity,
        rota_fixa_id: route.routeId,
        observacoes: payload.notes,
        atualizado_por: auth.user.id,
      })
      .eq('id', id)

    if (updateError) throw updateError

    try {
      await renewChangedVehicleDocuments(service, id, payload.documentDates, auth.user.id)
    } catch (documentError) {
      await service
        .from('veiculos')
        .update({
          tipo: currentVehicle.tipo,
          marca: currentVehicle.marca,
          modelo: currentVehicle.modelo,
          placa: currentVehicle.placa,
          ano: currentVehicle.ano,
          status_operacional: currentVehicle.status_operacional,
          km_atual: currentVehicle.km_atual,
          capacidade: currentVehicle.capacidade,
          rota_fixa_id: currentVehicle.rota_fixa_id,
          observacoes: currentVehicle.observacoes,
          atualizado_por: auth.user.id,
        })
        .eq('id', id)

      if (createdRouteId) await service.from('rotas').delete().eq('id', createdRouteId)
      throw documentError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (createdRouteId) {
      const { count } = await service
        .from('veiculos')
        .select('id', { count: 'exact', head: true })
        .eq('rota_fixa_id', createdRouteId)

      if (!count) await service.from('rotas').delete().eq('id', createdRouteId)
    }

    return vehicleErrorResponse(error, 'Não foi possível atualizar o veículo.')
  }
}
