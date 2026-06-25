import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows, type DatabaseRow } from '@/lib/supabase-query'
import { getTravelOperationLookups } from '@/lib/travel-operation-repository'
import { vehicleFleetCode, vehicleLabel } from '@/lib/vehicle-label'
import type {
  SinisterCostItem,
  SinisterListItem,
  SinisterLookups,
} from '@/types/sinister'

function mapCost(row: DatabaseRow): SinisterCostItem {
  return {
    id: row.id,
    category: row.categoria,
    description: row.descricao ?? '',
    quantity: toNumber(row.quantidade),
    unitValue: toNumber(row.valor_unitario),
    totalValue: toNumber(row.valor_total),
    receiptPath: row.comprovante_path ?? '',
  }
}

function mapSinister(
  row: DatabaseRow,
  costs: DatabaseRow[],
  vehicleById: Map<string, DatabaseRow>,
  driverById: Map<string, DatabaseRow>,
  profileById: Map<string, DatabaseRow>,
): SinisterListItem {
  const vehicle = vehicleById.get(row.veiculo_id)
  const driver = row.motorista_id ? driverById.get(row.motorista_id) : null
  const profile = driver ? profileById.get(driver.perfil_id) : null
  const sinisterCosts = costs.filter((cost) => cost.sinistro_id === row.id).map(mapCost)

  return {
    id: row.id,
    vehicleId: row.veiculo_id,
    vehicleFleetCode: vehicle ? vehicleFleetCode(vehicle) : 'Sem frota',
    vehicleLabel: vehicle ? vehicleLabel(vehicle) : 'Veiculo nao encontrado',
    driverId: row.motorista_id ?? null,
    driverName: profile?.nome ?? 'Sem motorista',
    occurredAt: row.data_ocorrencia,
    type: row.tipo,
    severity: row.severidade,
    status: row.status,
    location: row.local_ocorrencia ?? '',
    description: row.descricao ?? '',
    notes: row.observacoes ?? '',
    policeReport: row.boletim_ocorrencia ?? '',
    hasThirdParties: Boolean(row.terceiros_envolvidos),
    totalCost: sinisterCosts.reduce((total, cost) => total + cost.totalValue, 0),
    costsCount: sinisterCosts.length,
    costs: sinisterCosts,
  }
}

async function loadSinisterReferences(client: SupabaseClient, rows: DatabaseRow[]) {
  const vehicleIds = [...new Set(rows.map((row) => row.veiculo_id).filter(Boolean))]
  const driverIds = [...new Set(rows.map((row) => row.motorista_id).filter(Boolean))]

  const [vehicles, drivers] = await Promise.all([
    vehicleIds.length
      ? queryRows(
          client
            .from('veiculos')
            .select('id,codigo_frota,placa,marca,modelo')
            .in('id', vehicleIds),
        )
      : Promise.resolve([]),
    driverIds.length
      ? queryRows(
          client
            .from('motoristas')
            .select('id,perfil_id')
            .in('id', driverIds),
        )
      : Promise.resolve([]),
  ])
  const profileIds = drivers.map((driver) => driver.perfil_id).filter(Boolean)
  const profiles = profileIds.length
    ? await queryRows(client.from('perfis').select('id,nome').in('id', profileIds))
    : []

  return {
    vehicleById: new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    driverById: new Map(drivers.map((driver) => [driver.id, driver])),
    profileById: new Map(profiles.map((profile) => [profile.id, profile])),
  }
}

export async function listSinisters(
  client: SupabaseClient,
): Promise<{ items: SinisterListItem[]; lookups: SinisterLookups }> {
  const [rows, costs, lookups] = await Promise.all([
    queryRows(
      client
        .from('sinistros_operacionais')
        .select('*')
        .order('data_ocorrencia', { ascending: false }),
    ),
    queryRows(
      client
        .from('sinistro_custos')
        .select('id,sinistro_id,categoria,descricao,quantidade,valor_unitario,valor_total,comprovante_path')
        .order('criado_em', { ascending: true }),
    ),
    getTravelOperationLookups(client),
  ])
  const references = await loadSinisterReferences(client, rows)

  return {
    items: rows.map((row) => mapSinister(
      row,
      costs,
      references.vehicleById,
      references.driverById,
      references.profileById,
    )),
    lookups,
  }
}

export async function getSinisterDetails(
  client: SupabaseClient,
  sinisterId: string,
): Promise<{ sinister: SinisterListItem | null; lookups: SinisterLookups }> {
  const [rows, costs, lookups] = await Promise.all([
    queryRows(
      client
        .from('sinistros_operacionais')
        .select('*')
        .eq('id', sinisterId)
        .limit(1),
    ),
    queryRows(
      client
        .from('sinistro_custos')
        .select('id,sinistro_id,categoria,descricao,quantidade,valor_unitario,valor_total,comprovante_path')
        .eq('sinistro_id', sinisterId)
        .order('criado_em', { ascending: true }),
    ),
    getTravelOperationLookups(client),
  ])
  const row = rows[0]
  if (!row) return { sinister: null, lookups }

  const references = await loadSinisterReferences(client, rows)
  return {
    sinister: mapSinister(
      row,
      costs,
      references.vehicleById,
      references.driverById,
      references.profileById,
    ),
    lookups,
  }
}

export async function listVehicleSinisters(
  client: SupabaseClient,
  vehicleId: string,
): Promise<SinisterListItem[]> {
  const [rows, costs] = await Promise.all([
    queryRows(
      client
        .from('sinistros_operacionais')
        .select('*')
        .eq('veiculo_id', vehicleId)
        .order('data_ocorrencia', { ascending: false }),
    ),
    queryRows(
      client
        .from('sinistro_custos')
        .select('id,sinistro_id,categoria,descricao,quantidade,valor_unitario,valor_total,comprovante_path')
        .order('criado_em', { ascending: true }),
    ),
  ])
  const references = await loadSinisterReferences(client, rows)
  return rows.map((row) => mapSinister(
    row,
    costs,
    references.vehicleById,
    references.driverById,
    references.profileById,
  ))
}

export async function listSinisterCostsByVehicle(client: SupabaseClient) {
  const rows = await queryRows(
    client
      .from('sinistros_operacionais')
      .select('id,veiculo_id,status,sinistro_custos(valor_total)')
      .neq('status', 'cancelado'),
  )

  return rows.map((row) => ({
    vehicleId: row.veiculo_id as string,
    value: Array.isArray(row.sinistro_custos)
      ? row.sinistro_custos.reduce((total: number, cost: DatabaseRow) => total + toNumber(cost.valor_total), 0)
      : 0,
  }))
}
