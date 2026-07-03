import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import { vehicleFleetCode, vehicleLabel } from '@/lib/vehicle-label'
import type { TravelOperationLookups } from '@/types/travel-operation'

export async function getTravelOperationLookups(
  supabase: SupabaseClient,
): Promise<TravelOperationLookups> {
  const [vehicles, drivers, trips] = await Promise.all([
    queryRows(
      supabase
        .from('veiculos')
        .select('id,admin_responsavel_id,codigo_frota,placa,marca,modelo,km_atual,status_operacional')
        .is('excluido_em', null)
        .order('codigo_frota', { ascending: true }),
    ),
    queryRows(
      supabase
        .from('motoristas')
        .select('id,perfil_id,status_profissional')
        .is('excluido_em', null),
    ),
    queryRows(
      supabase
        .from('viagens')
        .select('id,motorista_id,veiculo_id,origem_snapshot,destino_snapshot,saiu_em,km_inicial,status')
        .neq('status', 'cancelada')
        .order('saiu_em', { ascending: false })
        .limit(200),
    ),
  ])

  const profileIds = drivers.map((driver) => driver.perfil_id).filter(Boolean)
  const profiles = profileIds.length
    ? await queryRows(
        supabase
          .from('perfis')
          .select('id,nome,ativo')
          .in('id', profileIds),
      )
    : []

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]))

  return {
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      ownerId: vehicle.admin_responsavel_id ?? null,
      fleetCode: vehicleFleetCode(vehicle),
      label: vehicleLabel(vehicle),
      currentKm: toNumber(vehicle.km_atual),
      status: vehicle.status_operacional,
    })),
    drivers: drivers
      .filter((driver) => {
        const profile = profileById.get(driver.perfil_id)
        return driver.status_profissional === 'ativo' && profile?.ativo
      })
      .map((driver) => ({
        id: driver.id,
        name: profileById.get(driver.perfil_id)?.nome ?? 'Motorista',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    trips: trips.map((trip) => {
      const vehicle = vehicleById.get(trip.veiculo_id)
      const driver = driverById.get(trip.motorista_id)
      const profile = driver ? profileById.get(driver.perfil_id) : null

      return {
        id: trip.id,
        vehicleId: trip.veiculo_id,
        driverId: trip.motorista_id,
        label: `${vehicle ? vehicleFleetCode(vehicle) : 'Veículo'} · ${profile?.nome ?? 'Motorista'} · ${trip.origem_snapshot} → ${trip.destino_snapshot}`,
        initialKm: toNumber(trip.km_inicial),
        status: trip.status,
      }
    }),
  }
}
