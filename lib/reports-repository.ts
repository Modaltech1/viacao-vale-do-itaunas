import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminAccess } from '@/lib/admin-scope'
import { toNumber } from '@/lib/driver-utils'
import { queryRows, type DatabaseRow } from '@/lib/supabase-query'
import { vehicleLabel } from '@/lib/vehicle-label'
import type {
  ReportCategoryValue,
  ReportData,
  ReportDelta,
  ReportDriverRow,
  ReportFilters,
  ReportInsight,
  ReportMetrics,
  ReportRouteRow,
  ReportTrendPoint,
  ReportVehicleRow,
} from '@/types/report'

type Period = {
  start: Date
  endExclusive: Date
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function percent(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0
}

function delta(current: number | null, previous: number | null): ReportDelta {
  if (current == null || previous == null) return { value: null, direction: 'flat' }
  if (previous === 0) {
    return current === 0
      ? { value: 0, direction: 'flat' }
      : { value: null, direction: 'new' }
  }
  const value = ((current - previous) / Math.abs(previous)) * 100
  return {
    value,
    direction: Math.abs(value) < 0.05 ? 'flat' : value > 0 ? 'up' : 'down',
  }
}

function inPeriod(value: string | null | undefined, period: Period) {
  if (!value) return false
  const date = new Date(value)
  return date >= period.start && date < period.endExclusive
}

function sum(rows: DatabaseRow[], field: string) {
  return rows.reduce((total, row) => total + toNumber(row[field]), 0)
}

function maintenanceValue(row: DatabaseRow) {
  return toNumber(row.valor_total_realizado)
}

function sinisterValue(row: DatabaseRow) {
  return Array.isArray(row.sinistro_custos)
    ? row.sinistro_custos.reduce((total: number, cost: DatabaseRow) => total + toNumber(cost.valor_total), 0)
    : 0
}

function reportMetrics(
  vehicles: DatabaseRow[],
  trips: DatabaseRow[],
  refuelings: DatabaseRow[],
  expenses: DatabaseRow[],
  maintenances: DatabaseRow[],
  sinisters: DatabaseRow[],
  criticalPendings: number,
) {
  const completedTrips = trips.filter((trip) => trip.status === 'concluida')
  const totalKm = sum(completedTrips, 'km_total')
  const fuelLiters = refuelings
    .filter((refueling) => refueling.tipo_combustivel !== 'ARLA')
    .reduce((total, refueling) => total + toNumber(refueling.litros), 0)
  const fuelCost = sum(refuelings, 'valor_total')
  const maintenanceCost = maintenances.reduce(
    (total, maintenance) => total + maintenanceValue(maintenance),
    0,
  )
  const expenseCost = sum(expenses, 'valor')
  const sinisterCost = sinisters.reduce((total, sinister) => total + sinisterValue(sinister), 0)
  const totalCost = fuelCost + maintenanceCost + expenseCost + sinisterCost
  const availableVehicles = vehicles.filter(
    (vehicle) => vehicle.status_operacional === 'ativo' || vehicle.status_operacional === 'reservado',
  ).length
  const usedVehicleIds = new Set(trips.map((trip) => trip.veiculo_id))
  const preventive = maintenances.filter(
    (maintenance) => maintenance.tipo_manutencao === 'preventiva',
  ).length

  return {
    totalCost,
    totalKm,
    costPerKm: totalKm > 0 ? totalCost / totalKm : null,
    fuelEfficiency: fuelLiters > 0 ? totalKm / fuelLiters : null,
    averageFuelPrice: fuelLiters > 0 ? fuelCost / fuelLiters : null,
    fleetAvailability: percent(availableVehicles, vehicles.length),
    fleetUtilization: percent(usedVehicleIds.size, vehicles.length),
    tripCompletionRate: percent(completedTrips.length, trips.length),
    preventiveMaintenanceRate: percent(preventive, maintenances.length),
    averageTripKm: completedTrips.length ? totalKm / completedTrips.length : null,
    activeVehicles: availableVehicles,
    totalVehicles: vehicles.length,
    criticalPendings,
    openMaintenances: maintenances.filter(
      (maintenance) => maintenance.status === 'aberta' || maintenance.status === 'em_andamento',
    ).length,
  }
}

function createTrend(period: Period): {
  points: Map<string, ReportTrendPoint>
  bucket: (value: string) => string
} {
  const totalDays = Math.max(
    1,
    Math.ceil((period.endExclusive.getTime() - period.start.getTime()) / 86_400_000),
  )
  const mode = totalDays > 120 ? 'month' : totalDays > 45 ? 'week' : 'day'
  const points = new Map<string, ReportTrendPoint>()

  function bucketDate(value: string) {
    const date = new Date(value)
    if (mode === 'month') return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
    if (mode === 'week') {
      const day = date.getUTCDay()
      const mondayOffset = day === 0 ? -6 : 1 - day
      date.setUTCDate(date.getUTCDate() + mondayOffset)
    }
    return dateOnly(date)
  }

  const cursor = new Date(period.start)
  while (cursor < period.endExclusive) {
    const key = bucketDate(cursor.toISOString())
    if (!points.has(key)) {
      const label = mode === 'month'
        ? new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(cursor)
        : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(cursor)
      points.set(key, { key, label, fuel: 0, maintenance: 0, expenses: 0, sinisters: 0, total: 0, km: 0 })
    }
    cursor.setUTCDate(cursor.getUTCDate() + (mode === 'month' ? 32 : mode === 'week' ? 7 : 1))
    if (mode === 'month') cursor.setUTCDate(1)
  }

  return { points, bucket: bucketDate }
}

function normalizeCategories(map: Map<string, { value: number; count: number }>) {
  return [...map.entries()]
    .map(([name, item]) => ({ name, value: item.value, count: item.count }))
    .sort((a, b) => b.value - a.value || b.count - a.count)
}

function createInsights(
  metrics: ReportMetrics,
  vehicles: ReportVehicleRow[],
  maintenance: ReportData['maintenance'],
): ReportInsight[] {
  const insights: ReportInsight[] = []
  const costDelta = metrics.deltas.totalCost.value
  if (costDelta != null && costDelta > 10) {
    insights.push({
      title: 'Custo operacional acelerou',
      description: `O gasto total cresceu ${Math.abs(costDelta).toFixed(1)}% frente ao período anterior.`,
      tone: 'danger',
    })
  } else if (costDelta != null && costDelta < -5) {
    insights.push({
      title: 'Eficiência financeira melhorou',
      description: `O gasto total recuou ${Math.abs(costDelta).toFixed(1)}% frente ao período anterior.`,
      tone: 'success',
    })
  }

  if (metrics.criticalPendings > 0) {
    insights.push({
      title: 'Risco operacional aberto',
      description: `${metrics.criticalPendings} pendência(s) crítica(s) exigem decisão ou correção.`,
      tone: 'danger',
    })
  }

  if (metrics.fleetAvailability < 80) {
    insights.push({
      title: 'Disponibilidade da frota pressionada',
      description: `${metrics.fleetAvailability.toFixed(1)}% dos veículos estão disponíveis neste momento.`,
      tone: 'warning',
    })
  }

  const totalVehicleCost = vehicles.reduce((total, vehicle) => total + vehicle.totalCost, 0)
  const leader = vehicles[0]
  if (leader && totalVehicleCost > 0 && leader.totalCost / totalVehicleCost >= 0.35) {
    insights.push({
      title: 'Custo concentrado em um ativo',
      description: `${leader.label} representa ${((leader.totalCost / totalVehicleCost) * 100).toFixed(1)}% do custo filtrado.`,
      tone: 'warning',
    })
  }

  if (maintenance.correctiveCount > maintenance.preventiveCount) {
    insights.push({
      title: 'Manutenção reativa domina o período',
      description: 'Houve mais intervenções corretivas que preventivas, aumentando risco de parada não planejada.',
      tone: 'warning',
    })
  }

  if (!insights.length) {
    insights.push({
      title: 'Operação sob controle',
      description: 'Os indicadores filtrados não apresentam concentração crítica ou deterioração relevante.',
      tone: 'success',
    })
  }

  return insights.slice(0, 4)
}

export async function getReportData(
  client: SupabaseClient,
  access: AdminAccess,
  filters: ReportFilters,
): Promise<ReportData> {
  const start = new Date(`${filters.startDate}T00:00:00.000Z`)
  const endExclusive = new Date(`${filters.endDate}T00:00:00.000Z`)
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
  const duration = endExclusive.getTime() - start.getTime()
  const previousEndExclusive = new Date(start)
  const previousStart = new Date(start.getTime() - duration)
  const totalPeriod = { start: previousStart, endExclusive }
  const currentPeriod = { start, endExclusive }
  const previousPeriod = { start: previousStart, endExclusive: previousEndExclusive }

  const vehicleQuery = access.isGlobal
    ? client
        .from('veiculos')
        .select('id,admin_responsavel_id,codigo_frota,placa,marca,modelo,status_operacional')
        .is('excluido_em', null)
        .order('codigo_frota')
    : client
        .from('veiculos')
        .select('id,admin_responsavel_id,codigo_frota,placa,marca,modelo,status_operacional')
        .is('excluido_em', null)
        .eq('admin_responsavel_id', access.userId)
        .order('codigo_frota')

  const driverQuery = access.isGlobal
    ? client
        .from('motoristas')
        .select('id,perfil_id,status_profissional,admin_responsavel_id')
        .is('excluido_em', null)
    : client
        .from('motoristas')
        .select('id,perfil_id,status_profissional,admin_responsavel_id')
        .is('excluido_em', null)
        .eq('admin_responsavel_id', access.userId)

  const partQuery = access.isGlobal
    ? client
        .from('pecas')
        .select('id,admin_responsavel_id,nome,unidade_medida,quantidade_estoque,estoque_minimo,valor_unitario,ativo')
        .is('excluido_em', null)
    : client
        .from('pecas')
        .select('id,admin_responsavel_id,nome,unidade_medida,quantidade_estoque,estoque_minimo,valor_unitario,ativo')
        .is('excluido_em', null)
        .eq('admin_responsavel_id', access.userId)

  const manualPendingQuery = access.isGlobal
    ? client
        .from('pendencias_manuais')
        .select('id')
        .eq('status', 'aberta')
    : client
        .from('pendencias_manuais')
        .select('id')
        .eq('status', 'aberta')
        .eq('admin_responsavel_id', access.userId)

  const [
    vehicleRows,
    driverRows,
    profileRows,
    serviceRows,
    tripRows,
    refuelingRows,
    expenseRows,
    maintenanceRows,
    sinisterRows,
    pendingRows,
    partRows,
    expensePartRows,
    manualPendingRows,
  ] = await Promise.all([
    queryRows(vehicleQuery),
    queryRows(driverQuery),
    queryRows(client.from('perfis').select('id,nome,ativo').eq('papel', 'motorista')),
    queryRows(
      client
        .from('servicos')
        .select('id,nome')
        .eq('ativo', true)
        .is('excluido_em', null)
        .order('nome'),
    ),
    queryRows(
      client
        .from('vw_viagens_detalhadas')
        .select('id,motorista_id,motorista_nome,veiculo_id,veiculo_codigo_frota,veiculo_placa,veiculo_marca,veiculo_modelo,origem_snapshot,destino_snapshot,saiu_em,chegou_em,status,km_total')
        .gte('saiu_em', totalPeriod.start.toISOString())
        .lt('saiu_em', totalPeriod.endExclusive.toISOString()),
    ),
    queryRows(
      client
        .from('abastecimentos')
        .select('id,viagem_id,motorista_id,veiculo_id,registrado_em,tipo_combustivel,litros,valor_total')
        .gte('registrado_em', totalPeriod.start.toISOString())
        .lt('registrado_em', totalPeriod.endExclusive.toISOString())
        .is('cancelado_em', null),
    ),
    queryRows(
      client
        .from('despesas_viagem')
        .select('id,motorista_id,veiculo_id,categoria,valor,registrado_em,viagem_id')
        .gte('registrado_em', totalPeriod.start.toISOString())
        .lt('registrado_em', totalPeriod.endExclusive.toISOString())
        .is('cancelado_em', null),
    ),
    queryRows(
      client
        .from('vw_manutencoes_detalhadas')
        .select('id,veiculo_id,tipo_manutencao,aberto_em,iniciado_em,concluido_em,status,valor_servicos,valor_pecas,valor_total_realizado,servicos,pecas')
        .gte('aberto_em', totalPeriod.start.toISOString())
        .lt('aberto_em', totalPeriod.endExclusive.toISOString())
        .neq('status', 'cancelada'),
    ),
    queryRows(
      client
        .from('sinistros_operacionais')
        .select('id,veiculo_id,motorista_id,data_ocorrencia,status,severidade,sinistro_custos(valor_total)')
        .gte('data_ocorrencia', totalPeriod.start.toISOString())
        .lt('data_ocorrencia', totalPeriod.endExclusive.toISOString())
        .neq('status', 'cancelado'),
    ),
    queryRows(
      client
        .from('vw_pendencias_operacionais')
        .select('chave,severidade,tipo,veiculo_id,motorista_id,servico_id,status')
        .eq('status', 'aberta'),
    ),
    queryRows(partQuery),
    queryRows(
      client
        .from('despesa_pecas')
        .select('despesa_id,peca_id,nome_snapshot,quantidade,valor_total,estoque_devolvido_em'),
    ),
    queryRows(manualPendingQuery),
  ])

  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]))
  const allowedDriverIds = new Set(
    driverRows
      .filter((driver) => !filters.driverId || driver.id === filters.driverId)
      .map((driver) => driver.id),
  )
  const allowedManualPendingKeys = new Set(
    manualPendingRows.map((pending) => `manual:${pending.id}`),
  )
  const selectedDriverAllowed = !filters.driverId || allowedDriverIds.has(filters.driverId)
  const allowedVehicleIds = new Set(
    vehicleRows
      .filter((vehicle) => !filters.vehicleId || vehicle.id === filters.vehicleId)
      .map((vehicle) => vehicle.id),
  )

  const filterTrip = (trip: DatabaseRow) => (
    selectedDriverAllowed
    && allowedVehicleIds.has(trip.veiculo_id)
    && (!filters.driverId || trip.motorista_id === filters.driverId)
  )
  const filterOperation = (row: DatabaseRow) => (
    selectedDriverAllowed
    && allowedVehicleIds.has(row.veiculo_id)
    && (!filters.driverId || row.motorista_id === filters.driverId)
  )
  const filterSinister = (row: DatabaseRow) => (
    selectedDriverAllowed
    && allowedVehicleIds.has(row.veiculo_id)
    && (!filters.driverId || row.motorista_id === filters.driverId)
  )
  const filterMaintenance = (maintenance: DatabaseRow) => {
    if (!allowedVehicleIds.has(maintenance.veiculo_id)) return false
    if (filters.maintenanceType && maintenance.tipo_manutencao !== filters.maintenanceType) return false
    if (filters.serviceId) {
      return Array.isArray(maintenance.servicos)
        && maintenance.servicos.some((service: DatabaseRow) => service.id === filters.serviceId)
    }
    return true
  }

  const allTrips = tripRows.filter(filterTrip)
  const allRefuelings = refuelingRows.filter(filterOperation)
  const allExpenses = expenseRows.filter(filterOperation)
  const allMaintenances = maintenanceRows.filter(filterMaintenance)
  const allSinisters = sinisterRows.filter(filterSinister)
  const currentTrips = allTrips.filter((row) => inPeriod(row.saiu_em, currentPeriod))
  const previousTrips = allTrips.filter((row) => inPeriod(row.saiu_em, previousPeriod))
  const currentRefuelings = allRefuelings.filter((row) => inPeriod(row.registrado_em, currentPeriod))
  const previousRefuelings = allRefuelings.filter((row) => inPeriod(row.registrado_em, previousPeriod))
  const currentExpenses = allExpenses.filter((row) => inPeriod(row.registrado_em, currentPeriod))
  const previousExpenses = allExpenses.filter((row) => inPeriod(row.registrado_em, previousPeriod))
  const currentMaintenances = allMaintenances.filter((row) => inPeriod(row.aberto_em, currentPeriod))
  const previousMaintenances = allMaintenances.filter((row) => inPeriod(row.aberto_em, previousPeriod))
  const currentSinisters = allSinisters.filter((row) => inPeriod(row.data_ocorrencia, currentPeriod))
  const previousSinisters = allSinisters.filter((row) => inPeriod(row.data_ocorrencia, previousPeriod))
  const filteredVehicles = vehicleRows.filter((vehicle) => allowedVehicleIds.has(vehicle.id))
  const currentPendings = pendingRows.filter((pending) => {
    const belongsToScope = access.isGlobal
      || (pending.veiculo_id && allowedVehicleIds.has(pending.veiculo_id))
      || (pending.motorista_id && allowedDriverIds.has(pending.motorista_id))
      || (pending.chave && allowedManualPendingKeys.has(pending.chave))

    return Boolean(
      belongsToScope
      && (!filters.driverId || pending.motorista_id === filters.driverId)
      && (!filters.serviceId || pending.servico_id === filters.serviceId)
    )
  })
  const criticalPendings = currentPendings.filter((pending) => pending.severidade === 'critica').length

  const current = reportMetrics(
    filteredVehicles,
    currentTrips,
    currentRefuelings,
    currentExpenses,
    currentMaintenances,
    currentSinisters,
    criticalPendings,
  )
  const previous = reportMetrics(
    filteredVehicles,
    previousTrips,
    previousRefuelings,
    previousExpenses,
    previousMaintenances,
    previousSinisters,
    0,
  )

  const metrics: ReportMetrics = {
    ...current,
    deltas: {
      totalCost: delta(current.totalCost, previous.totalCost),
      totalKm: delta(current.totalKm, previous.totalKm),
      costPerKm: delta(current.costPerKm, previous.costPerKm),
      fuelEfficiency: delta(current.fuelEfficiency, previous.fuelEfficiency),
    },
  }

  const vehicles: ReportVehicleRow[] = filteredVehicles.map((vehicle) => {
    const trips = currentTrips.filter((trip) => trip.veiculo_id === vehicle.id)
    const completedTrips = trips.filter((trip) => trip.status === 'concluida')
    const refuelings = currentRefuelings.filter((item) => item.veiculo_id === vehicle.id)
    const expenses = currentExpenses.filter((item) => item.veiculo_id === vehicle.id)
    const maintenances = currentMaintenances.filter((item) => item.veiculo_id === vehicle.id)
    const sinisters = currentSinisters.filter((item) => item.veiculo_id === vehicle.id)
    const km = sum(completedTrips, 'km_total')
    const liters = refuelings
      .filter((item) => item.tipo_combustivel !== 'ARLA')
      .reduce((total, item) => total + toNumber(item.litros), 0)
    const fuelCost = sum(refuelings, 'valor_total')
    const maintenanceCost = maintenances.reduce((total, item) => total + maintenanceValue(item), 0)
    const expenseCost = sum(expenses, 'valor')
    const sinisterCost = sinisters.reduce((total, item) => total + sinisterValue(item), 0)
    const totalCost = fuelCost + maintenanceCost + expenseCost + sinisterCost

    return {
      id: vehicle.id,
      label: vehicleLabel(vehicle),
      status: vehicle.status_operacional,
      trips: trips.length,
      km,
      liters,
      fuelCost,
      maintenanceCost,
      expenseCost,
      sinisterCost,
      totalCost,
      costPerKm: km > 0 ? totalCost / km : null,
      consumption: liters > 0 ? km / liters : null,
    }
  }).sort((a, b) => b.totalCost - a.totalCost)

  const drivers: ReportDriverRow[] = driverRows
    .filter((driver) => !filters.driverId || driver.id === filters.driverId)
    .map((driver) => {
      const trips = currentTrips.filter((trip) => trip.motorista_id === driver.id)
      const completedTrips = trips.filter((trip) => trip.status === 'concluida')
      const km = sum(completedTrips, 'km_total')
      const refuelings = currentRefuelings.filter((item) => item.motorista_id === driver.id)
      const expenses = currentExpenses.filter((item) => item.motorista_id === driver.id)
      return {
        id: driver.id,
        name: profileById.get(driver.perfil_id)?.nome ?? 'Motorista',
        trips: trips.length,
        completedTrips: completedTrips.length,
        km,
        averageTripKm: completedTrips.length ? km / completedTrips.length : null,
        fuelCost: sum(refuelings, 'valor_total'),
        expenseCost: sum(expenses, 'valor'),
        completionRate: percent(completedTrips.length, trips.length),
      }
    })
    .filter((driver) => driver.trips > 0 || driver.km > 0)
    .sort((a, b) => b.km - a.km)

  const trendBuilder = createTrend(currentPeriod)
  function addTrend(
    dateValue: string,
    field: 'fuel' | 'maintenance' | 'expenses' | 'sinisters' | 'km',
    value: number,
  ) {
    const point = trendBuilder.points.get(trendBuilder.bucket(dateValue))
    if (!point) return
    point[field] += value
    if (field !== 'km') point.total += value
  }
  currentRefuelings.forEach((item) => addTrend(item.registrado_em, 'fuel', toNumber(item.valor_total)))
  currentExpenses.forEach((item) => addTrend(item.registrado_em, 'expenses', toNumber(item.valor)))
  currentMaintenances.forEach((item) => addTrend(item.aberto_em, 'maintenance', maintenanceValue(item)))
  currentSinisters.forEach((item) => addTrend(item.data_ocorrencia, 'sinisters', sinisterValue(item)))
  currentTrips
    .filter((item) => item.status === 'concluida')
    .forEach((item) => addTrend(item.saiu_em, 'km', toNumber(item.km_total)))
  const trend: ReportTrendPoint[] = [...trendBuilder.points.values()]

  const expenseMap = new Map<string, { value: number; count: number }>()
  currentExpenses.forEach((expense) => {
    const currentItem = expenseMap.get(expense.categoria) ?? { value: 0, count: 0 }
    currentItem.value += toNumber(expense.valor)
    currentItem.count += 1
    expenseMap.set(expense.categoria, currentItem)
  })
  const expenseCategories = normalizeCategories(expenseMap)

  const maintenanceCategoryMap = new Map<string, { value: number; count: number }>()
  currentMaintenances.forEach((maintenance) => {
    const services = Array.isArray(maintenance.servicos) ? maintenance.servicos : []
    services.forEach((service: DatabaseRow) => {
      const category = service.categoria ?? 'Outros'
      const currentItem = maintenanceCategoryMap.get(category) ?? { value: 0, count: 0 }
      currentItem.value += toNumber(service.valor)
      currentItem.count += 1
      maintenanceCategoryMap.set(category, currentItem)
    })
  })
  const resolvedMaintenances = currentMaintenances.filter(
    (maintenance) => maintenance.status === 'concluida' && maintenance.concluido_em,
  )
  const resolutionHours = resolvedMaintenances.map((maintenance) => (
    (new Date(maintenance.concluido_em).getTime()
      - new Date(maintenance.iniciado_em ?? maintenance.aberto_em).getTime()) / 3_600_000
  ))
  const maintenance = {
    preventiveCount: currentMaintenances.filter((item) => item.tipo_manutencao === 'preventiva').length,
    correctiveCount: currentMaintenances.filter((item) => item.tipo_manutencao === 'corretiva').length,
    preventiveCost: currentMaintenances
      .filter((item) => item.tipo_manutencao === 'preventiva')
      .reduce((total, item) => total + maintenanceValue(item), 0),
    correctiveCost: currentMaintenances
      .filter((item) => item.tipo_manutencao === 'corretiva')
      .reduce((total, item) => total + maintenanceValue(item), 0),
    servicesCost: sum(currentMaintenances, 'valor_servicos'),
    partsCost: sum(currentMaintenances, 'valor_pecas'),
    completedCount: resolvedMaintenances.length,
    openCount: current.openMaintenances,
    averageResolutionHours: resolutionHours.length
      ? resolutionHours.reduce((total, hours) => total + hours, 0) / resolutionHours.length
      : null,
    categories: normalizeCategories(maintenanceCategoryMap),
  }

  const partConsumptionMap = new Map<string, { value: number; count: number }>()
  let consumedQuantity = 0
  currentMaintenances.forEach((item) => {
    const parts = Array.isArray(item.pecas) ? item.pecas : []
    parts.forEach((part: DatabaseRow) => {
      if (part.estoqueDevolvidoEm) return
      const quantity = toNumber(part.quantidade)
      const totalValue = toNumber(part.valorTotal)
      const currentPart = partConsumptionMap.get(part.nome) ?? { value: 0, count: 0 }
      currentPart.value += totalValue
      currentPart.count += 1
      consumedQuantity += quantity
      partConsumptionMap.set(part.nome, currentPart)
    })
  })
  const currentExpenseIds = new Set(currentExpenses.map((expense) => expense.id))
  expensePartRows
    .filter((item) => currentExpenseIds.has(item.despesa_id) && !item.estoque_devolvido_em)
    .forEach((part) => {
      const quantity = toNumber(part.quantidade)
      const totalValue = toNumber(part.valor_total)
      const currentPart = partConsumptionMap.get(part.nome_snapshot) ?? { value: 0, count: 0 }
      currentPart.value += totalValue
      currentPart.count += 1
      consumedQuantity += quantity
      partConsumptionMap.set(part.nome_snapshot, currentPart)
    })
  const activeParts = partRows.filter((part) => part.ativo)
  const inventory = {
    stockValue: activeParts.reduce(
      (total, part) => (
        total + toNumber(part.quantidade_estoque) * toNumber(part.valor_unitario)
      ),
      0,
    ),
    lowStockCount: activeParts.filter(
      (part) => (
        toNumber(part.quantidade_estoque) > 0
        && toNumber(part.quantidade_estoque) <= toNumber(part.estoque_minimo)
      ),
    ).length,
    outOfStockCount: activeParts.filter(
      (part) => toNumber(part.quantidade_estoque) === 0,
    ).length,
    consumedCost: [...partConsumptionMap.values()].reduce(
      (total, item) => total + item.value,
      0,
    ),
    consumedQuantity,
    topParts: normalizeCategories(partConsumptionMap).slice(0, 8),
  }

  const riskSeverityMap = new Map<string, { value: number; count: number }>()
  const riskTypeMap = new Map<string, { value: number; count: number }>()
  currentPendings.forEach((pending) => {
    const severity = riskSeverityMap.get(pending.severidade) ?? { value: 0, count: 0 }
    severity.value += 1
    severity.count += 1
    riskSeverityMap.set(pending.severidade, severity)
    const type = riskTypeMap.get(pending.tipo) ?? { value: 0, count: 0 }
    type.value += 1
    type.count += 1
    riskTypeMap.set(pending.tipo, type)
  })

  const tripCostById = new Map<string, number>()
  currentRefuelings.forEach((item) => {
    if (!item.viagem_id) return
    tripCostById.set(item.viagem_id, (tripCostById.get(item.viagem_id) ?? 0) + toNumber(item.valor_total))
  })
  currentExpenses.forEach((item) => {
    if (!item.viagem_id) return
    tripCostById.set(item.viagem_id, (tripCostById.get(item.viagem_id) ?? 0) + toNumber(item.valor))
  })
  const routeMap = new Map<string, ReportRouteRow>()
  currentTrips.forEach((trip) => {
    const name = `${trip.origem_snapshot} → ${trip.destino_snapshot}`
    const route = routeMap.get(name) ?? { name, trips: 0, km: 0, totalCost: 0, costPerKm: null }
    route.trips += 1
    route.km += trip.status === 'concluida' ? toNumber(trip.km_total) : 0
    route.totalCost += tripCostById.get(trip.id) ?? 0
    route.costPerKm = route.km > 0 ? route.totalCost / route.km : null
    routeMap.set(name, route)
  })
  const routes = [...routeMap.values()].sort((a, b) => b.km - a.km)

  const costBreakdown: ReportCategoryValue[] = [
    { name: 'Combustível', value: currentRefuelings.reduce((total, item) => total + toNumber(item.valor_total), 0) },
    { name: 'Manutenção', value: currentMaintenances.reduce((total, item) => total + maintenanceValue(item), 0) },
    { name: 'Despesas operacionais', value: currentExpenses.reduce((total, item) => total + toNumber(item.valor), 0) },
    { name: 'Sinistros', value: currentSinisters.reduce((total, item) => total + sinisterValue(item), 0) },
  ]

  return {
    period: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      previousStartDate: dateOnly(previousStart),
      previousEndDate: dateOnly(new Date(previousEndExclusive.getTime() - 86_400_000)),
    },
    metrics,
    costBreakdown,
    trend,
    vehicles,
    drivers,
    expenseCategories,
    routes,
    maintenance,
    inventory,
    risks: {
      bySeverity: normalizeCategories(riskSeverityMap),
      byType: normalizeCategories(riskTypeMap),
    },
    insights: createInsights(metrics, vehicles, maintenance),
    options: {
      vehicles: vehicleRows.map((vehicle) => ({
        id: vehicle.id,
        label: vehicleLabel(vehicle),
      })),
      drivers: driverRows
        .filter((driver) => profileById.get(driver.perfil_id)?.ativo)
        .map((driver) => ({ id: driver.id, label: profileById.get(driver.perfil_id)?.nome ?? 'Motorista' }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      services: serviceRows.map((service) => ({ id: service.id, label: service.nome })),
    },
  }
}
