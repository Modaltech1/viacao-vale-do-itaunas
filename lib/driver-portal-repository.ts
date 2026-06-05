import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDriverLicenseStatus, toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import type {
  DriverPortalData,
  DriverPortalVehicle,
} from '@/types/driver-portal'

export async function getDriverPortalData(
  supabase: SupabaseClient,
  userId: string,
  driverId: string,
): Promise<DriverPortalData | null> {
  const [profiles, drivers, assignments, trips] = await Promise.all([
    queryRows(
      supabase
        .from('perfis')
        .select('id,nome,email,telefone')
        .eq('id', userId),
    ),
    queryRows(
      supabase
        .from('motoristas')
        .select('id,cpf,numero_habilitacao,categoria_habilitacao,validade_habilitacao,status_profissional')
        .eq('id', driverId)
        .is('excluido_em', null),
    ),
    queryRows(
      supabase
        .from('veiculo_motoristas')
        .select('veiculo_id,principal,tipo_vinculo')
        .eq('motorista_id', driverId)
        .eq('ativo', true)
        .is('fim_em', null)
        .order('principal', { ascending: false }),
    ),
    queryRows(
      supabase
        .from('viagens')
        .select('id,veiculo_id,origem_snapshot,destino_snapshot,saiu_em,km_inicial,observacoes')
        .eq('motorista_id', driverId)
        .eq('status', 'em_andamento')
        .limit(1),
    ),
  ])

  const profile = profiles[0]
  const driver = drivers[0]
  if (!profile || !driver) return null

  const vehicleIds = [...new Set([
    ...assignments.map((assignment) => assignment.veiculo_id),
    ...trips.map((trip) => trip.veiculo_id),
  ])]

  const vehicles = vehicleIds.length
    ? await queryRows(
        supabase
          .from('veiculos')
          .select('id,tipo,marca,modelo,placa,km_atual,status_operacional,rota_fixa_id')
          .in('id', vehicleIds)
          .is('excluido_em', null),
      )
    : []

  const routeIds = [...new Set(vehicles.map((vehicle) => vehicle.rota_fixa_id).filter(Boolean))]
  const routes = routeIds.length
    ? await queryRows(
        supabase
          .from('rotas')
          .select('id,nome,origem,destino,km_estimado')
          .in('id', routeIds)
          .eq('ativo', true)
          .is('excluido_em', null),
      )
    : []

  const routeById = new Map(routes.map((route) => [route.id, route]))
  const assignmentByVehicle = new Map(
    assignments.map((assignment) => [assignment.veiculo_id, assignment]),
  )

  const normalizedVehicles: DriverPortalVehicle[] = vehicles.map((vehicle) => {
    const assignment = assignmentByVehicle.get(vehicle.id)
    const route = vehicle.rota_fixa_id ? routeById.get(vehicle.rota_fixa_id) : null

    return {
      id: vehicle.id,
      type: vehicle.tipo,
      brand: vehicle.marca,
      model: vehicle.modelo,
      plate: vehicle.placa,
      currentKm: toNumber(vehicle.km_atual),
      status: vehicle.status_operacional,
      principal: Boolean(assignment?.principal),
      linkType: assignment?.tipo_vinculo ?? 'temporario',
      route: route
        ? {
            id: route.id,
            name: route.nome,
            origin: route.origem,
            destination: route.destino,
            estimatedKm: route.km_estimado == null ? null : toNumber(route.km_estimado),
          }
        : null,
    }
  }).sort((a, b) => Number(b.principal) - Number(a.principal) || a.plate.localeCompare(b.plate))

  const trip = trips[0]
  const currentVehicle = trip
    ? normalizedVehicles.find((vehicle) => vehicle.id === trip.veiculo_id) ?? null
    : null

  const [refuelings, expenses] = trip
    ? await Promise.all([
        queryRows(
          supabase
            .from('abastecimentos')
            .select('id,registrado_em,km_registrado,tipo_combustivel,litros')
            .eq('viagem_id', trip.id)
            .is('cancelado_em', null)
            .order('registrado_em', { ascending: false }),
        ),
        queryRows(
          supabase
            .from('despesas_viagem')
            .select('id,registrado_em,categoria,valor')
            .eq('viagem_id', trip.id)
            .is('cancelado_em', null)
            .order('registrado_em', { ascending: false })
            .limit(3),
        ),
      ])
    : [[], []]

  return {
    profile: {
      id: driver.id,
      name: profile.nome ?? 'Motorista',
      email: profile.email ?? '',
      phone: profile.telefone ?? '',
      cpf: driver.cpf ?? '',
      licenseNumber: driver.numero_habilitacao ?? '',
      licenseCategory: driver.categoria_habilitacao ?? '',
      licenseDueDate: driver.validade_habilitacao ?? '',
      licenseStatus: getDriverLicenseStatus(driver.validade_habilitacao),
      professionalStatus: driver.status_profissional,
    },
    vehicles: normalizedVehicles,
    currentTrip: trip && currentVehicle
      ? {
          id: trip.id,
          vehicleId: trip.veiculo_id,
          vehicle: currentVehicle,
          origin: trip.origem_snapshot,
          destination: trip.destino_snapshot,
          startedAt: trip.saiu_em,
          initialKm: toNumber(trip.km_inicial),
          latestRecordedKm: Math.max(
            toNumber(trip.km_inicial),
            ...refuelings.map((refueling) => toNumber(refueling.km_registrado)),
          ),
          notes: trip.observacoes ?? '',
        }
      : null,
    recentRefuelings: refuelings.slice(0, 3).map((refueling) => ({
      id: refueling.id,
      registeredAt: refueling.registrado_em,
      registeredKm: toNumber(refueling.km_registrado),
      fuelType: refueling.tipo_combustivel,
      liters: toNumber(refueling.litros),
    })),
    recentExpenses: expenses.map((expense) => ({
      id: expense.id,
      registeredAt: expense.registrado_em,
      category: expense.categoria,
      value: toNumber(expense.valor),
    })),
  }
}
