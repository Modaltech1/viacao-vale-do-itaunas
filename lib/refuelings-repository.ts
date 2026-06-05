import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import type {
  RefuelingListItem,
  RefuelingLookups,
} from '@/types/refueling'

export async function listRefuelings(
  supabase: SupabaseClient,
): Promise<{ items: RefuelingListItem[]; lookups: RefuelingLookups }> {
  const [refuelings, vehicles, drivers, trips] = await Promise.all([
    queryRows(
      supabase
        .from('abastecimentos')
        .select('id,viagem_id,motorista_id,veiculo_id,registrado_em,km_registrado,tipo_combustivel,litros,valor_unitario,valor_total,observacoes')
        .is('cancelado_em', null)
        .order('registrado_em', { ascending: false }),
    ),
    queryRows(
      supabase
        .from('veiculos')
        .select('id,placa,marca,modelo,km_atual,status_operacional')
        .is('excluido_em', null)
        .order('placa', { ascending: true }),
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
      const driver = refueling.motorista_id
        ? driverById.get(refueling.motorista_id)
        : null
      const profile = driver ? profileById.get(driver.perfil_id) : null

      return {
        id: refueling.id,
        tripId: refueling.viagem_id ?? null,
        vehicleId: refueling.veiculo_id,
        vehicleLabel: vehicle
          ? `${vehicle.placa} · ${vehicle.marca} ${vehicle.modelo}`
          : 'Veículo não encontrado',
        driverId: refueling.motorista_id ?? null,
        driverName: profile?.nome ?? 'Sem motorista',
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
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        label: `${vehicle.placa} · ${vehicle.marca} ${vehicle.modelo}`,
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
          label: `${vehicle?.placa ?? 'Veículo'} · ${profile?.nome ?? 'Motorista'} · ${trip.origem_snapshot} → ${trip.destino_snapshot}`,
          initialKm: toNumber(trip.km_inicial),
          latestRecordedKm: Math.max(
            toNumber(trip.km_inicial),
            ...(refuelingsByTrip.get(trip.id) ?? []),
          ),
          status: trip.status,
        }
      }),
    },
  }
}
