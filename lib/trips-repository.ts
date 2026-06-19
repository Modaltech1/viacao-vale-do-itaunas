import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import { vehicleFleetCode, vehicleLabel } from '@/lib/vehicle-label'
import type {
  TripDetails,
  TripFormOptions,
  TripListItem,
} from '@/types/trip'

function normalizeTrip(row: Record<string, any>): TripListItem {
  return {
    id: row.id,
    driverId: row.motorista_id,
    driverName: row.motorista_nome ?? 'Motorista não encontrado',
    vehicleId: row.veiculo_id,
    vehicleFleetCode: vehicleFleetCode({
      codigo_frota: row.veiculo_codigo_frota,
      placa: row.veiculo_placa,
    }),
    vehicleLabel: vehicleLabel({
      codigo_frota: row.veiculo_codigo_frota,
      placa: row.veiculo_placa,
      marca: row.veiculo_marca,
      modelo: row.veiculo_modelo,
    }),
    routeId: row.rota_id ?? null,
    routeName: row.rota_nome_snapshot ?? '',
    origin: row.origem_snapshot,
    destination: row.destino_snapshot,
    estimatedKm: row.km_estimado_snapshot == null
      ? null
      : toNumber(row.km_estimado_snapshot),
    startedAt: row.saiu_em,
    finishedAt: row.chegou_em ?? null,
    status: row.status,
    initialKm: toNumber(row.km_inicial),
    finalKm: row.km_final == null ? null : toNumber(row.km_final),
    totalKm: row.km_total == null ? null : toNumber(row.km_total),
    temporaryVehicle: Boolean(row.veiculo_temporario),
    notes: row.observacoes ?? '',
    fuelLiters: toNumber(row.litros_combustivel),
    refuelingValue: toNumber(row.valor_abastecimento),
    expenseValue: toNumber(row.valor_despesas),
  }
}

export async function listTrips(supabase: SupabaseClient): Promise<TripListItem[]> {
  const rows = await queryRows(
    supabase
      .from('vw_viagens_detalhadas')
      .select('*')
      .order('saiu_em', { ascending: false }),
  )

  return rows.map(normalizeTrip)
}

export async function getTripDetails(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripDetails | null> {
  const rows = await queryRows(
    supabase
      .from('vw_viagens_detalhadas')
      .select('*')
      .eq('id', tripId),
  )
  const row = rows[0]
  if (!row) return null

  const [refuelings, expenses] = await Promise.all([
    queryRows(
      supabase
        .from('abastecimentos')
        .select('id,registrado_em,km_registrado,tipo_combustivel,litros,valor_unitario,valor_total')
        .eq('viagem_id', tripId)
        .is('cancelado_em', null)
        .order('registrado_em', { ascending: false }),
    ),
    queryRows(
      supabase
        .from('despesas_viagem')
        .select('id,registrado_em,categoria,valor,observacoes')
        .eq('viagem_id', tripId)
        .is('cancelado_em', null)
        .order('registrado_em', { ascending: false }),
    ),
  ])

  const trip = normalizeTrip(row)
  return {
    ...trip,
    latestRecordedKm: Math.max(
      trip.initialKm,
      ...refuelings.map((refueling) => toNumber(refueling.km_registrado)),
    ),
    refuelings: refuelings.map((refueling) => ({
      id: refueling.id,
      registeredAt: refueling.registrado_em,
      registeredKm: toNumber(refueling.km_registrado),
      fuelType: refueling.tipo_combustivel,
      liters: toNumber(refueling.litros),
      unitValue: refueling.valor_unitario == null ? null : toNumber(refueling.valor_unitario),
      totalValue: refueling.valor_total == null ? null : toNumber(refueling.valor_total),
    })),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      registeredAt: expense.registrado_em,
      category: expense.categoria,
      value: toNumber(expense.valor),
      notes: expense.observacoes ?? '',
    })),
  }
}

export async function getTripFormOptions(
  supabase: SupabaseClient,
): Promise<TripFormOptions> {
  const [drivers, vehicles, routes, assignments, profiles] = await Promise.all([
    queryRows(
      supabase
        .from('motoristas')
        .select('id,perfil_id,status_profissional')
        .eq('status_profissional', 'ativo')
        .is('excluido_em', null),
    ),
    queryRows(
      supabase
        .from('veiculos')
        .select('id,codigo_frota,placa,marca,modelo,km_atual,status_operacional,rota_fixa_id')
        .is('excluido_em', null)
        .order('codigo_frota', { ascending: true }),
    ),
    queryRows(
      supabase
        .from('rotas')
        .select('id,nome,origem,destino')
        .eq('ativo', true)
        .is('excluido_em', null),
    ),
    queryRows(
      supabase
        .from('veiculo_motoristas')
        .select('veiculo_id,motorista_id')
        .eq('ativo', true)
        .is('fim_em', null),
    ),
    queryRows(
      supabase
        .from('perfis')
        .select('id,nome,ativo')
        .eq('papel', 'motorista')
        .eq('ativo', true),
    ),
  ])

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const routeById = new Map(routes.map((route) => [route.id, route]))

  return {
    drivers: drivers
      .filter((driver) => profileById.has(driver.perfil_id))
      .map((driver) => ({
        id: driver.id,
        name: profileById.get(driver.perfil_id)?.nome ?? 'Motorista',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    vehicles: vehicles.map((vehicle) => {
      const route = vehicle.rota_fixa_id ? routeById.get(vehicle.rota_fixa_id) : null
      return {
        id: vehicle.id,
        label: vehicleLabel(vehicle),
        currentKm: toNumber(vehicle.km_atual),
        status: vehicle.status_operacional,
        routeId: route?.id ?? null,
        routeName: route?.nome ?? '',
        routeOrigin: route?.origem ?? '',
        routeDestination: route?.destino ?? '',
        linkedDriverIds: assignments
          .filter((assignment) => assignment.veiculo_id === vehicle.id)
          .map((assignment) => assignment.motorista_id),
      }
    }),
  }
}
