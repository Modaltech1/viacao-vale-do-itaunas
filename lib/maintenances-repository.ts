import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows, type DatabaseRow } from '@/lib/supabase-query'
import { vehicleFleetCode, vehicleLabel } from '@/lib/vehicle-label'
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
  const parts = Array.isArray(row.pecas)
    ? row.pecas.filter(Boolean).map((part: DatabaseRow) => ({
        id: part.id,
        partId: part.pecaId,
        code: part.codigo,
        name: part.nome,
        unit: part.unidade,
        quantity: toNumber(part.quantidade),
        unitValue: toNumber(part.valorUnitario),
        totalValue: toNumber(part.valorTotal),
        returnedAt: part.estoqueDevolvidoEm ?? null,
      }))
    : []

  return {
    id: row.id,
    vehicleId: row.veiculo_id,
    vehicleFleetCode: vehicleFleetCode({
      codigo_frota: row.veiculo_codigo_frota,
      placa: row.veiculo_placa,
    }),
    vehiclePlate: row.veiculo_placa,
    vehicleLabel: vehicleLabel({
      codigo_frota: row.veiculo_codigo_frota,
      placa: row.veiculo_placa,
      marca: row.veiculo_marca,
      modelo: row.veiculo_modelo,
    }),
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
    servicesValue: toNumber(row.valor_servicos),
    partsValue: toNumber(row.valor_pecas),
    notes: row.observacoes ?? '',
    cancellationReason: row.motivo_cancelamento ?? '',
    services,
    parts,
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
  const [vehicles, services, mechanics, parts] = await Promise.all([
    queryRows(
      client
        .from('veiculos')
        .select('id,codigo_frota,placa,marca,modelo,km_atual,status_operacional')
        .is('excluido_em', null)
        .order('codigo_frota', { ascending: true }),
    ),
    queryRows(
      client
        .from('servicos')
        .select('id,nome,categoria,tipo_manutencao_sugerido,valor_padrao')
        .eq('ativo', true)
        .is('excluido_em', null)
        .order('nome', { ascending: true }),
    ),
    queryRows(
      client
        .from('mecanicos')
        .select('id,perfil_id,status_profissional')
        .eq('status_profissional', 'ativo')
        .is('excluido_em', null)
    ),
    queryRows(
      client
        .from('pecas')
        .select('id,codigo,nome,unidade_medida,quantidade_estoque,valor_unitario')
        .eq('ativo', true)
        .is('excluido_em', null)
        .order('nome', { ascending: true }),
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
      label: vehicleLabel(vehicle),
      currentKm: toNumber(vehicle.km_atual),
      status: vehicle.status_operacional,
    })),
    services: services.map((service) => ({
      id: service.id,
      name: service.nome,
      category: service.categoria,
      suggestedMaintenanceType: service.tipo_manutencao_sugerido,
      defaultValue: toNumber(service.valor_padrao),
    })),
    parts: parts.map((part) => ({
      id: part.id,
      code: part.codigo,
      name: part.nome,
      unit: part.unidade_medida,
      stockQuantity: toNumber(part.quantidade_estoque),
      unitValue: toNumber(part.valor_unitario),
    })),
    mechanics: mechanics.flatMap((mechanic) => {
      const profile = profileById.get(mechanic.perfil_id)
      if (!profile) return []
      return [{ id: mechanic.id, name: profile.nome ?? 'Mecânico sem nome' }]
    }),
    currentMechanicId,
  }
}
