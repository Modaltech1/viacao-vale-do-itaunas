import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { queryRows, type DatabaseRow } from '@/lib/supabase-query'
import { toNumber } from '@/lib/driver-utils'
import type {
  VehicleDetails,
  VehicleDocument,
  VehicleDriver,
  VehicleDriverOption,
  VehicleFormOptions,
  VehicleListItem,
  VehicleRoute,
} from '@/types/vehicle'

function normalizeRoute(row?: DatabaseRow | null): VehicleRoute | null {
  if (!row?.rota_fixa_id && !row?.id) return null

  return {
    id: row.rota_fixa_id ?? row.id,
    name: row.rota_nome ?? row.nome ?? '',
    origin: row.rota_origem ?? row.origem ?? '',
    destination: row.rota_destino ?? row.destino ?? '',
    estimatedKm: row.km_estimado == null ? null : toNumber(row.km_estimado),
    notes: row.observacoes ?? '',
  }
}

function normalizeDocument(row: DatabaseRow): VehicleDocument {
  return {
    id: row.id,
    code: row.tipo_codigo,
    name: row.tipo_nome,
    number: row.numero ?? '',
    issuedAt: row.emitido_em ?? null,
    dueDate: row.vencimento_em,
    status: row.status_calculado,
    severity: row.severidade_calculada,
  }
}

async function loadVehicleRelations(service: SupabaseClient, vehicleIds: string[]) {
  if (!vehicleIds.length) {
    return {
      assignments: [] as DatabaseRow[],
      drivers: [] as DatabaseRow[],
      profiles: [] as DatabaseRow[],
      documents: [] as DatabaseRow[],
      pendings: [] as DatabaseRow[],
    }
  }

  const [assignments, documents, pendings] = await Promise.all([
    queryRows(
      service
        .from('veiculo_motoristas')
        .select('veiculo_id,motorista_id,principal,tipo_vinculo,inicio_em')
        .in('veiculo_id', vehicleIds)
        .eq('ativo', true)
        .is('fim_em', null)
        .order('principal', { ascending: false }),
    ),
    queryRows(
      service
        .from('vw_documentos_veiculo_status')
        .select('id,veiculo_id,tipo_codigo,tipo_nome,numero,emitido_em,vencimento_em,status_calculado,severidade_calculada')
        .in('veiculo_id', vehicleIds),
    ),
    queryRows(
      service
        .from('vw_pendencias_operacionais')
        .select('veiculo_id,severidade,status')
        .in('veiculo_id', vehicleIds)
        .eq('status', 'aberta'),
    ),
  ])

  const driverIds = [...new Set(assignments.map((assignment) => assignment.motorista_id))]
  const drivers = driverIds.length
    ? await queryRows(service.from('motoristas').select('id,perfil_id').in('id', driverIds))
    : []
  const profileIds = drivers.map((driver) => driver.perfil_id).filter(Boolean)
  const profiles = profileIds.length
    ? await queryRows(service.from('perfis').select('id,nome,telefone').in('id', profileIds))
    : []

  return { assignments, drivers, profiles, documents, pendings }
}

export async function listVehicles(service: SupabaseClient): Promise<VehicleListItem[]> {
  const rows = await queryRows(
    service
      .from('vw_veiculos_resumo')
      .select('*')
      .order('placa', { ascending: true }),
  )

  if (!rows.length) return []

  const vehicleIds = rows.map((row) => row.id)
  const {
    assignments,
    drivers,
    profiles,
    documents,
    pendings,
  } = await loadVehicleRelations(service, vehicleIds)
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))

  return rows.map((row) => {
    const vehicleDrivers: VehicleDriver[] = assignments
      .filter((assignment) => assignment.veiculo_id === row.id)
      .flatMap((assignment) => {
        const driver = driverById.get(assignment.motorista_id)
        const profile = driver ? profileById.get(driver.perfil_id) : null
        if (!driver || !profile) return []

        return [{
          id: driver.id,
          name: profile.nome ?? 'Motorista sem nome',
          phone: profile.telefone ?? '',
          principal: Boolean(assignment.principal),
          linkType: assignment.tipo_vinculo,
          startedAt: assignment.inicio_em,
        }]
      })

    return {
      id: row.id,
      type: row.tipo,
      brand: row.marca,
      model: row.modelo,
      plate: row.placa,
      year: row.ano == null ? null : Number(row.ano),
      status: row.status_operacional,
      currentKm: toNumber(row.km_atual),
      capacity: row.capacidade ?? '',
      notes: row.observacoes ?? '',
      route: normalizeRoute(row),
      drivers: vehicleDrivers,
      documents: documents
        .filter((document) => document.veiculo_id === row.id)
        .map(normalizeDocument),
      averageConsumption: row.consumo_medio_km_l == null ? null : toNumber(row.consumo_medio_km_l),
      totalRefuelingCost: toNumber(row.custo_abastecimento_total),
      totalMaintenanceCost: toNumber(row.custo_manutencao_total),
      totalTravelExpenses: toNumber(row.custo_despesas_total),
      totalOperationalCost: toNumber(row.custo_total_operacional),
      pendingCount: pendings.filter((pending) => pending.veiculo_id === row.id).length,
      criticalPendingCount: pendings.filter(
        (pending) => pending.veiculo_id === row.id && pending.severidade === 'critica',
      ).length,
    }
  })
}

export async function listVehicleFormOptions(service: SupabaseClient): Promise<VehicleFormOptions> {
  const [routes, drivers, profiles, principalAssignments, vehicles] = await Promise.all([
    queryRows(
      service
        .from('rotas')
        .select('id,nome,origem,destino,km_estimado,observacoes')
        .eq('ativo', true)
        .is('excluido_em', null)
        .order('nome', { ascending: true }),
    ),
    queryRows(
      service
        .from('motoristas')
        .select('id,perfil_id,status_profissional')
        .is('excluido_em', null),
    ),
    queryRows(
      service
        .from('perfis')
        .select('id,nome,email,ativo')
        .eq('papel', 'motorista')
        .order('nome', { ascending: true }),
    ),
    queryRows(
      service
        .from('veiculo_motoristas')
        .select('motorista_id,veiculo_id')
        .eq('ativo', true)
        .eq('principal', true)
        .is('fim_em', null),
    ),
    queryRows(service.from('veiculos').select('id,placa,marca,modelo').is('excluido_em', null)),
  ])

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const principalByDriver = new Map(
    principalAssignments.map((assignment) => [assignment.motorista_id, assignment]),
  )

  const driverOptions: VehicleDriverOption[] = drivers.flatMap((driver) => {
    const profile = profileById.get(driver.perfil_id)
    if (!profile) return []

    const principalAssignment = principalByDriver.get(driver.id)
    const vehicle = principalAssignment ? vehicleById.get(principalAssignment.veiculo_id) : null

    return [{
      id: driver.id,
      name: profile.nome ?? 'Motorista sem nome',
      email: profile.email ?? '',
      professionalStatus: driver.status_profissional,
      accessActive: Boolean(profile.ativo),
      principalVehicleId: vehicle?.id ?? null,
      principalVehicleLabel: vehicle
        ? `${vehicle.placa} · ${vehicle.marca} ${vehicle.modelo}`
        : null,
    }]
  })

  return {
    routes: routes.map((route) => normalizeRoute(route) as VehicleRoute),
    drivers: driverOptions.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  }
}

export async function getVehicleDetails(
  service: SupabaseClient,
  vehicleId: string,
  scope: 'admin' | 'mechanic' = 'admin',
): Promise<VehicleDetails | null> {
  const vehicles = await listVehicles(service)
  const vehicle = vehicles.find((item) => item.id === vehicleId)
  if (!vehicle) return null

  const [vehicleRows, trips, refuelings, maintenances, schedules, pendings] = await Promise.all([
    queryRows(
      service
        .from('veiculos')
        .select('observacoes,rota_fixa_id')
        .eq('id', vehicleId)
        .is('excluido_em', null),
    ),
    scope === 'admin'
      ? queryRows(
          service
            .from('vw_viagens_detalhadas')
            .select('id,motorista_nome,origem_snapshot,destino_snapshot,saiu_em,chegou_em,km_inicial,km_final,status')
            .eq('veiculo_id', vehicleId)
            .order('saiu_em', { ascending: false }),
        )
      : Promise.resolve([]),
    scope === 'admin'
      ? queryRows(
          service
            .from('abastecimentos')
            .select('id,registrado_em,km_registrado,tipo_combustivel,litros,valor_total')
            .eq('veiculo_id', vehicleId)
            .is('cancelado_em', null)
            .order('registrado_em', { ascending: false }),
        )
      : Promise.resolve([]),
    queryRows(
      service
        .from('vw_manutencoes_detalhadas')
        .select('id,tipo_manutencao,causa,aberto_em,status,valor_total_realizado,mecanico_responsavel_nome,servicos')
        .eq('veiculo_id', vehicleId)
        .order('aberto_em', { ascending: false }),
    ),
    queryRows(
      service
        .from('vw_servicos_programados_status')
        .select('id,servico_nome,servico_categoria,periodicidade_tipo_snapshot,ultimo_realizado_em,ultimo_realizado_km,proximo_vencimento_em,proximo_vencimento_km,status_calculado')
        .eq('veiculo_id', vehicleId)
        .eq('ativo', true)
        .is('excluido_em', null)
        .order('servico_nome', { ascending: true }),
    ),
    queryRows(
      service
        .from('vw_pendencias_operacionais')
        .select('chave,titulo,descricao,severidade,tipo,vencimento_em,vencimento_km,status,acao_label')
        .eq('veiculo_id', vehicleId)
      .eq('status', 'aberta'),
    ),
  ])

  const sourceVehicle = vehicleRows[0]
  const routeRows = sourceVehicle?.rota_fixa_id
    ? await queryRows(
        service
          .from('rotas')
          .select('id,nome,origem,destino,km_estimado,observacoes')
          .eq('id', sourceVehicle.rota_fixa_id)
          .is('excluido_em', null),
      )
    : []

  return {
    ...vehicle,
    notes: sourceVehicle?.observacoes ?? '',
    route: normalizeRoute(routeRows[0]),
    trips: trips.map((trip) => ({
      id: trip.id,
      driverName: trip.motorista_nome ?? 'Motorista não informado',
      origin: trip.origem_snapshot,
      destination: trip.destino_snapshot,
      startedAt: trip.saiu_em,
      finishedAt: trip.chegou_em ?? null,
      initialKm: toNumber(trip.km_inicial),
      finalKm: trip.km_final == null ? null : toNumber(trip.km_final),
      status: trip.status,
    })),
    refuelings: refuelings.map((refueling) => ({
      id: refueling.id,
      registeredAt: refueling.registrado_em,
      registeredKm: toNumber(refueling.km_registrado),
      fuelType: refueling.tipo_combustivel,
      liters: toNumber(refueling.litros),
      totalValue: refueling.valor_total == null ? null : toNumber(refueling.valor_total),
    })),
    maintenances: maintenances.map((maintenance) => ({
      id: maintenance.id,
      maintenanceType: maintenance.tipo_manutencao,
      cause: maintenance.causa ?? '',
      openedAt: maintenance.aberto_em,
      status: maintenance.status,
      value: toNumber(maintenance.valor_total_realizado),
      mechanicName: maintenance.mecanico_responsavel_nome ?? 'Não definido',
      services: Array.isArray(maintenance.servicos)
        ? maintenance.servicos.map((service: DatabaseRow) => service.nome).filter(Boolean)
        : [],
    })),
    serviceSchedules: schedules.map((schedule) => ({
      id: schedule.id,
      serviceName: schedule.servico_nome,
      category: schedule.servico_categoria,
      periodicityType: schedule.periodicidade_tipo_snapshot,
      lastDoneAt: schedule.ultimo_realizado_em ?? null,
      lastDoneKm: schedule.ultimo_realizado_km == null ? null : toNumber(schedule.ultimo_realizado_km),
      nextDueAt: schedule.proximo_vencimento_em ?? null,
      nextDueKm: schedule.proximo_vencimento_km == null ? null : toNumber(schedule.proximo_vencimento_km),
      status: schedule.status_calculado,
    })),
    pendings: pendings.map((pending) => ({
      id: pending.chave,
      title: pending.titulo,
      description: pending.descricao ?? '',
      severity: pending.severidade,
      type: pending.tipo,
      dueDate: pending.vencimento_em ?? null,
      dueKm: pending.vencimento_km == null ? null : toNumber(pending.vencimento_km),
      status: pending.status,
      actionLabel: pending.acao_label,
    })),
  }
}
