import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows, type DatabaseRow } from '@/lib/supabase-query'
import type {
  MaintenanceDetails,
  MaintenanceFormOptions,
  MaintenanceListItem,
  MaintenanceServiceItem,
} from '@/types/maintenance'

function normalizeService(service: DatabaseRow): MaintenanceServiceItem {
  return {
    id: service.item_id ?? service.id ?? `${service.servico_id}-${service.nome}`,
    serviceId: service.servico_id ?? service.id,
    name: service.nome ?? 'Serviço sem nome',
    category: service.categoria,
    value: service.valor == null ? null : toNumber(service.valor),
    notes: service.observacoes ?? '',
  }
}

function normalizeMaintenance(row: DatabaseRow): MaintenanceListItem {
  const services = Array.isArray(row.servicos)
    ? row.servicos.filter(Boolean).map(normalizeService)
    : []

  return {
    id: row.id,
    vehicleId: row.veiculo_id,
    vehiclePlate: row.veiculo_placa,
    vehicleLabel: `${row.veiculo_placa} · ${row.veiculo_marca} ${row.veiculo_modelo}`,
    maintenanceType: row.tipo_manutencao,
    cause: row.causa ?? '',
    openedAt: row.aberto_em,
    startedAt: row.iniciado_em ?? null,
    completedAt: row.concluido_em ?? null,
    vehicleKm: row.km_veiculo == null ? null : toNumber(row.km_veiculo),
    responsibleMechanicId: row.mecanico_responsavel_id ?? null,
    responsibleMechanicName: row.mecanico_responsavel_nome ?? 'Não definido',
    status: row.status,
    totalValue: toNumber(row.valor_total_realizado),
    notes: row.observacoes ?? '',
    cancellationReason: row.motivo_cancelamento ?? '',
    services,
  }
}

export async function listMaintenances(
  client: SupabaseClient,
): Promise<MaintenanceListItem[]> {
  const rows = await queryRows(
    client
      .from('vw_manutencoes_detalhadas')
      .select('*')
      .order('aberto_em', { ascending: false }),
  )

  return rows.map(normalizeMaintenance)
}

export async function getMaintenanceDetails(
  client: SupabaseClient,
  maintenanceId: string,
): Promise<MaintenanceDetails | null> {
  const rows = await queryRows(
    client
      .from('vw_manutencoes_detalhadas')
      .select('*')
      .eq('id', maintenanceId),
  )

  return rows[0] ? normalizeMaintenance(rows[0]) : null
}

export async function listMaintenanceFormOptions(
  client: SupabaseClient,
  currentMechanicId: string | null = null,
): Promise<MaintenanceFormOptions> {
  const [vehicles, services, mechanics] = await Promise.all([
    queryRows(
      client
        .from('veiculos')
        .select('id,placa,marca,modelo,km_atual,status_operacional')
        .is('excluido_em', null)
        .order('placa', { ascending: true }),
    ),
    queryRows(
      client
        .from('servicos')
        .select('id,nome,categoria,tipo_manutencao_sugerido')
        .eq('ativo', true)
        .is('excluido_em', null)
        .order('nome', { ascending: true }),
    ),
    queryRows(
      client
        .from('mecanicos')
        .select('id,perfil_id,status_profissional')
        .eq('status_profissional', 'ativo')
        .is('excluido_em', null),
    ),
  ])

  const profileIds = mechanics.map((mechanic) => mechanic.perfil_id).filter(Boolean)
  const profiles = profileIds.length
    ? await queryRows(
        client
          .from('perfis')
          .select('id,nome,ativo')
          .in('id', profileIds)
          .eq('ativo', true),
      )
    : []
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))

  return {
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: `${vehicle.placa} · ${vehicle.marca} ${vehicle.modelo}`,
      currentKm: toNumber(vehicle.km_atual),
      status: vehicle.status_operacional,
    })),
    services: services.map((service) => ({
      id: service.id,
      name: service.nome,
      category: service.categoria,
      suggestedMaintenanceType: service.tipo_manutencao_sugerido,
    })),
    mechanics: mechanics.flatMap((mechanic) => {
      const profile = profileById.get(mechanic.perfil_id)
      if (!profile) return []
      return [{ id: mechanic.id, name: profile.nome ?? 'Mecânico sem nome' }]
    }),
    currentMechanicId,
  }
}
