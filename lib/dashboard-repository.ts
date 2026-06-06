import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import type { DashboardAlert, DashboardData } from '@/types/dashboard'

type DashboardFilters = {
  startDate: string | null
  endDate: string | null
  vehicleId: string | null
  driverId: string | null
}

function alertHref(alert: Record<string, any>) {
  if (alert.manutencao_id) return `/admin/manutencoes/${alert.manutencao_id}`
  if (alert.veiculo_id) return `/admin/veiculos/${alert.veiculo_id}`
  if (alert.motorista_id) return `/admin/motoristas/${alert.motorista_id}`
  return '/admin/pendencias'
}

export async function getDashboardData(
  supabase: SupabaseClient,
  filters: DashboardFilters,
): Promise<DashboardData> {
  const { data: metricsResult, error: metricsError } = await supabase.rpc(
    'fn_dashboard_admin',
    {
      p_inicio: filters.startDate,
      p_fim: filters.endDate,
      p_veiculo_id: filters.vehicleId,
      p_motorista_id: filters.driverId,
    },
  )
  if (metricsError) throw new Error(metricsError.message)

  const [vehicleRows, driverRows, profileRows, assignments] = await Promise.all([
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
        .from('perfis')
        .select('id,nome,ativo')
        .eq('papel', 'motorista'),
    ),
    queryRows(
      supabase
        .from('veiculo_motoristas')
        .select('veiculo_id,motorista_id')
        .eq('ativo', true)
        .is('fim_em', null),
    ),
  ])

  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]))
  const selectedDriverVehicleIds = filters.driverId
    ? new Set(
        assignments
          .filter((assignment) => assignment.motorista_id === filters.driverId)
          .map((assignment) => assignment.veiculo_id),
      )
    : null

  let pendingQuery = supabase
    .from('vw_pendencias_operacionais')
    .select('chave,titulo,descricao,severidade,tipo,veiculo_id,motorista_id,manutencao_id,status')
    .eq('status', 'aberta')

  if (filters.vehicleId && filters.driverId) {
    pendingQuery = pendingQuery.or(
      `veiculo_id.eq.${filters.vehicleId},motorista_id.eq.${filters.driverId}`,
    )
  } else if (filters.vehicleId) {
    pendingQuery = pendingQuery.eq('veiculo_id', filters.vehicleId)
  } else if (filters.driverId) {
    const linkedVehicleIds = [...(selectedDriverVehicleIds ?? [])]
    pendingQuery = linkedVehicleIds.length
      ? pendingQuery.or(
          `motorista_id.eq.${filters.driverId},veiculo_id.in.(${linkedVehicleIds.join(',')})`,
        )
      : pendingQuery.eq('motorista_id', filters.driverId)
  }

  const pendingRows = await queryRows(pendingQuery)
  const severityOrder = { critica: 0, atencao: 1, baixa: 2 }
  const alerts: DashboardAlert[] = pendingRows
    .sort((a, b) => (
      (severityOrder[a.severidade as keyof typeof severityOrder] ?? 3)
      - (severityOrder[b.severidade as keyof typeof severityOrder] ?? 3)
    ))
    .slice(0, 5)
    .map((alert) => ({
      id: alert.chave,
      title: alert.titulo,
      description: alert.descricao ?? '',
      severity: alert.severidade,
      type: alert.tipo,
      vehicleId: alert.veiculo_id ?? null,
      driverId: alert.motorista_id ?? null,
      maintenanceId: alert.manutencao_id ?? null,
      href: alertHref(alert),
    }))

  const metrics = (metricsResult ?? {}) as Record<string, unknown>
  return {
    metrics: {
      totalVehicles: toNumber(metrics.total_veiculos),
      maintenanceVehicles: toNumber(metrics.veiculos_em_manutencao),
      openTrips: toNumber(metrics.viagens_em_andamento),
      criticalPendings: toNumber(metrics.pendencias_criticas),
      totalKm: toNumber(metrics.km_rodados),
      totalLiters: toNumber(metrics.litros_abastecidos),
      averageConsumption: metrics.consumo_medio == null
        ? null
        : toNumber(metrics.consumo_medio),
      refuelingCost: toNumber(metrics.gasto_abastecimento),
      maintenanceCost: toNumber(metrics.gasto_manutencao),
      travelExpenseCost: toNumber(metrics.gasto_despesas),
      totalCost: toNumber(metrics.gasto_total),
    },
    alerts,
    vehicles: vehicleRows
      .filter((vehicle) => !filters.vehicleId || vehicle.id === filters.vehicleId)
      .filter((vehicle) => !selectedDriverVehicleIds || selectedDriverVehicleIds.has(vehicle.id))
      .sort((a, b) => {
        const priority = {
          indisponivel: 0,
          em_manutencao: 1,
          reservado: 2,
          ativo: 3,
          inativo: 4,
        }
        return (
          (priority[a.status_operacional as keyof typeof priority] ?? 5)
          - (priority[b.status_operacional as keyof typeof priority] ?? 5)
          || a.placa.localeCompare(b.placa, 'pt-BR')
        )
      })
      .slice(0, 6)
      .map((vehicle) => ({
        id: vehicle.id,
        label: `${vehicle.placa} · ${vehicle.marca} ${vehicle.modelo}`,
        currentKm: toNumber(vehicle.km_atual),
        status: vehicle.status_operacional,
      })),
    options: {
      vehicles: vehicleRows.map((vehicle) => ({
        id: vehicle.id,
        label: `${vehicle.placa} · ${vehicle.marca} ${vehicle.modelo}`,
      })),
      drivers: driverRows
        .filter((driver) => {
          const profile = profileById.get(driver.perfil_id)
          return driver.status_profissional === 'ativo' && profile?.ativo
        })
        .map((driver) => ({
          id: driver.id,
          label: profileById.get(driver.perfil_id)?.nome ?? 'Motorista',
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    },
  }
}
