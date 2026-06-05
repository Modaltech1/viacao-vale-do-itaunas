import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDriverLicenseStatus, toNumber } from '@/lib/driver-utils'
import type {
  DriverDetails,
  DriverExpense,
  DriverListItem,
  DriverRefueling,
  DriverTrip,
  DriverVehicle,
  DriverVehicleOption,
} from '@/types/driver'

type Row = Record<string, any>

async function queryRows(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

function vehicleLabel(vehicle?: Row) {
  return vehicle ? `${vehicle.placa} · ${vehicle.marca} ${vehicle.modelo}` : 'Veículo não encontrado'
}

export async function listDriverVehicleOptions(service: SupabaseClient): Promise<DriverVehicleOption[]> {
  const [vehicles, assignments, drivers, profiles] = await Promise.all([
    queryRows(
      service
        .from('veiculos')
        .select('id,placa,marca,modelo')
        .is('excluido_em', null)
        .order('placa', { ascending: true }),
    ),
    queryRows(
      service
        .from('veiculo_motoristas')
        .select('veiculo_id,motorista_id,principal')
        .eq('ativo', true)
        .is('fim_em', null),
    ),
    queryRows(service.from('motoristas').select('id,perfil_id').is('excluido_em', null)),
    queryRows(service.from('perfis').select('id,nome').eq('papel', 'motorista')),
  ])

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]))
  const primaryByVehicle = new Map(
    assignments
      .filter((assignment) => assignment.principal)
      .map((assignment) => [assignment.veiculo_id, assignment]),
  )

  return vehicles.map((vehicle) => {
    const assignment = primaryByVehicle.get(vehicle.id)
    const driver = assignment ? driverById.get(assignment.motorista_id) : null
    const profile = driver ? profileById.get(driver.perfil_id) : null

    return {
      id: vehicle.id,
      label: vehicleLabel(vehicle),
      currentDriverName: profile?.nome ?? null,
    }
  })
}

export async function listDrivers(service: SupabaseClient): Promise<DriverListItem[]> {
  const drivers = await queryRows(
    service
      .from('motoristas')
      .select('*')
      .is('excluido_em', null)
      .order('criado_em', { ascending: false }),
  )

  if (!drivers.length) return []

  const driverIds = drivers.map((driver) => driver.id)
  const profileIds = drivers.map((driver) => driver.perfil_id).filter(Boolean)

  const [profiles, assignments, trips, refuelings, expenses] = await Promise.all([
    queryRows(service.from('perfis').select('id,nome,email,telefone,ativo').in('id', profileIds)),
    queryRows(
      service
        .from('veiculo_motoristas')
        .select('motorista_id,veiculo_id,principal,inicio_em')
        .in('motorista_id', driverIds)
        .eq('ativo', true)
        .is('fim_em', null)
        .order('principal', { ascending: false }),
    ),
    queryRows(
      service
        .from('viagens')
        .select('motorista_id,status,km_inicial,km_final')
        .in('motorista_id', driverIds),
    ),
    queryRows(
      service
        .from('abastecimentos')
        .select('motorista_id,tipo_combustivel,litros')
        .in('motorista_id', driverIds)
        .is('cancelado_em', null),
    ),
    queryRows(
      service
        .from('despesas_viagem')
        .select('motorista_id,valor')
        .in('motorista_id', driverIds)
        .is('cancelado_em', null),
    ),
  ])

  const vehicleIds = [...new Set(assignments.map((assignment) => assignment.veiculo_id))]
  const vehicles = vehicleIds.length
    ? await queryRows(service.from('veiculos').select('id,placa,marca,modelo,km_atual,status_operacional').in('id', vehicleIds))
    : []

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))

  return drivers.map((driver) => {
    const profile = profileById.get(driver.perfil_id) ?? {}
    const driverAssignments = assignments.filter((assignment) => assignment.motorista_id === driver.id)
    const currentAssignment = driverAssignments.find((assignment) => assignment.principal) ?? driverAssignments[0]
    const vehicle = currentAssignment ? vehicleById.get(currentAssignment.veiculo_id) : null
    const driverTrips = trips.filter((trip) => trip.motorista_id === driver.id)

    return {
      id: driver.id,
      profileId: driver.perfil_id,
      name: profile.nome ?? 'Motorista sem nome',
      email: profile.email ?? '',
      phone: profile.telefone ?? '',
      cpf: driver.cpf ?? '',
      address: driver.endereco ?? '',
      licenseNumber: driver.numero_habilitacao ?? '',
      licenseCategory: driver.categoria_habilitacao ?? '',
      licenseDueDate: driver.validade_habilitacao ?? '',
      licenseStatus: getDriverLicenseStatus(driver.validade_habilitacao),
      professionalStatus: driver.status_profissional,
      accessActive: Boolean(profile.ativo),
      notes: driver.observacoes ?? '',
      vehicle: vehicle
        ? {
            id: vehicle.id,
            plate: vehicle.placa,
            brand: vehicle.marca,
            model: vehicle.modelo,
            currentKm: toNumber(vehicle.km_atual),
            status: vehicle.status_operacional,
            principal: Boolean(currentAssignment?.principal),
          }
        : null,
      tripsCount: driverTrips.length,
      totalKm: driverTrips
        .filter((trip) => trip.status === 'concluida' && trip.km_final != null)
        .reduce((total, trip) => total + toNumber(trip.km_final) - toNumber(trip.km_inicial), 0),
      totalLiters: refuelings
        .filter((refueling) => refueling.motorista_id === driver.id && refueling.tipo_combustivel !== 'ARLA')
        .reduce((total, refueling) => total + toNumber(refueling.litros), 0),
      totalExpenses: expenses
        .filter((expense) => expense.motorista_id === driver.id)
        .reduce((total, expense) => total + toNumber(expense.valor), 0),
    }
  })
}

export async function getDriverDetails(service: SupabaseClient, driverId: string): Promise<DriverDetails | null> {
  const items = await listDrivers(service)
  const driver = items.find((item) => item.id === driverId)
  if (!driver) return null

  const [assignments, trips, refuelings, expenses] = await Promise.all([
    queryRows(
      service
        .from('veiculo_motoristas')
        .select('veiculo_id,principal')
        .eq('motorista_id', driverId)
        .eq('ativo', true)
        .is('fim_em', null)
        .order('principal', { ascending: false }),
    ),
    queryRows(
      service
        .from('viagens')
        .select('id,veiculo_id,origem_snapshot,destino_snapshot,saiu_em,chegou_em,km_inicial,km_final,status')
        .eq('motorista_id', driverId)
        .order('saiu_em', { ascending: false }),
    ),
    queryRows(
      service
        .from('abastecimentos')
        .select('id,veiculo_id,registrado_em,tipo_combustivel,litros,km_registrado,valor_total')
        .eq('motorista_id', driverId)
        .is('cancelado_em', null)
        .order('registrado_em', { ascending: false }),
    ),
    queryRows(
      service
        .from('despesas_viagem')
        .select('id,veiculo_id,registrado_em,categoria,valor,observacoes')
        .eq('motorista_id', driverId)
        .is('cancelado_em', null)
        .order('registrado_em', { ascending: false }),
    ),
  ])

  const vehicleIds = [
    ...new Set([
      ...assignments.map((item) => item.veiculo_id),
      ...trips.map((item) => item.veiculo_id),
      ...refuelings.map((item) => item.veiculo_id),
      ...expenses.map((item) => item.veiculo_id),
    ]),
  ]

  const vehicles = vehicleIds.length
    ? await queryRows(service.from('veiculos').select('id,placa,marca,modelo,km_atual,status_operacional').in('id', vehicleIds))
    : []
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))

  const activeVehicles: DriverVehicle[] = assignments.flatMap((assignment) => {
    const vehicle = vehicleById.get(assignment.veiculo_id)
    if (!vehicle) return []

    return [{
      id: vehicle.id,
      plate: vehicle.placa,
      brand: vehicle.marca,
      model: vehicle.modelo,
      currentKm: toNumber(vehicle.km_atual),
      status: vehicle.status_operacional,
      principal: Boolean(assignment.principal),
    }]
  })

  const normalizedTrips: DriverTrip[] = trips.map((trip) => ({
    id: trip.id,
    vehicle: vehicleLabel(vehicleById.get(trip.veiculo_id)),
    origin: trip.origem_snapshot,
    destination: trip.destino_snapshot,
    startedAt: trip.saiu_em,
    finishedAt: trip.chegou_em,
    initialKm: toNumber(trip.km_inicial),
    finalKm: trip.km_final == null ? null : toNumber(trip.km_final),
    status: trip.status,
  }))

  const normalizedRefuelings: DriverRefueling[] = refuelings.map((refueling) => ({
    id: refueling.id,
    vehicle: vehicleLabel(vehicleById.get(refueling.veiculo_id)),
    registeredAt: refueling.registrado_em,
    fuelType: refueling.tipo_combustivel,
    liters: toNumber(refueling.litros),
    registeredKm: toNumber(refueling.km_registrado),
    totalValue: refueling.valor_total == null ? null : toNumber(refueling.valor_total),
  }))

  const normalizedExpenses: DriverExpense[] = expenses.map((expense) => ({
    id: expense.id,
    vehicle: vehicleLabel(vehicleById.get(expense.veiculo_id)),
    registeredAt: expense.registrado_em,
    category: expense.categoria,
    value: toNumber(expense.valor),
    notes: expense.observacoes ?? '',
  }))

  return {
    ...driver,
    vehicles: activeVehicles,
    trips: normalizedTrips,
    refuelings: normalizedRefuelings,
    expenses: normalizedExpenses,
  }
}
