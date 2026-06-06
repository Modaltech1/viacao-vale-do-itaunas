import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import { getTravelOperationLookups } from '@/lib/travel-operation-repository'
import type {
  RefuelingListItem,
  RefuelingLookups,
} from '@/types/refueling'

export async function listRefuelings(
  supabase: SupabaseClient,
): Promise<{ items: RefuelingListItem[]; lookups: RefuelingLookups }> {
  const [refuelings, baseLookups] = await Promise.all([
    queryRows(
      supabase
        .from('abastecimentos')
        .select('id,viagem_id,motorista_id,veiculo_id,registrado_em,km_registrado,tipo_combustivel,litros,valor_unitario,valor_total,observacoes')
        .is('cancelado_em', null)
        .order('registrado_em', { ascending: false }),
    ),
    getTravelOperationLookups(supabase),
  ])

  const vehicleById = new Map(baseLookups.vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const driverById = new Map(baseLookups.drivers.map((driver) => [driver.id, driver]))
  const refuelingsByTrip = new Map<string, number[]>()

  refuelings.forEach((refueling) => {
    if (!refueling.viagem_id) return
    const values = refuelingsByTrip.get(refueling.viagem_id) ?? []
    values.push(toNumber(refueling.km_registrado))
    refuelingsByTrip.set(refueling.viagem_id, values)
  })

  return {
    items: refuelings.map((refueling) => {
      const vehicle = vehicleById.get(refueling.veiculo_id)
      const driver = refueling.motorista_id ? driverById.get(refueling.motorista_id) : null

      return {
        id: refueling.id,
        tripId: refueling.viagem_id ?? null,
        vehicleId: refueling.veiculo_id,
        vehicleLabel: vehicle?.label ?? 'Veículo não encontrado',
        driverId: refueling.motorista_id ?? null,
        driverName: driver?.name ?? 'Sem motorista',
        registeredAt: refueling.registrado_em,
        registeredKm: toNumber(refueling.km_registrado),
        fuelType: refueling.tipo_combustivel,
        liters: toNumber(refueling.litros),
        unitValue: refueling.valor_unitario == null
          ? null
          : toNumber(refueling.valor_unitario),
        totalValue: refueling.valor_total == null
          ? null
          : toNumber(refueling.valor_total),
        notes: refueling.observacoes ?? '',
      }
    }),
    lookups: {
      vehicles: baseLookups.vehicles,
      drivers: baseLookups.drivers,
      trips: baseLookups.trips.map((trip) => ({
          ...trip,
          latestRecordedKm: Math.max(
            trip.initialKm,
            ...(refuelingsByTrip.get(trip.id) ?? []),
          ),
      })),
    },
  }
}
