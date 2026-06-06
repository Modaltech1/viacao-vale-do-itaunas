import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import type {
  PendingFormOptions,
  PendingListItem,
} from '@/types/pending'

type PendingMode = 'admin' | 'mechanic'

function pendingHref(row: Record<string, any>, mode: PendingMode) {
  if (
    row.veiculo_id
    && (row.tipo === 'servico_km' || row.tipo === 'servico_tempo')
  ) {
    const base = mode === 'admin' ? '/admin/manutencoes' : '/mechanic'
    return `${base}?newMaintenance=1&vehicleId=${row.veiculo_id}`
  }
  if (row.manutencao_id) {
    return mode === 'admin'
      ? `/admin/manutencoes/${row.manutencao_id}`
      : `/mechanic/manutencoes/${row.manutencao_id}`
  }
  if (row.veiculo_id) {
    return mode === 'admin'
      ? `/admin/veiculos/${row.veiculo_id}`
      : `/mechanic/veiculos/${row.veiculo_id}`
  }
  if (mode === 'admin' && row.motorista_id) return `/admin/motoristas/${row.motorista_id}`
  if (mode === 'admin' && row.mecanico_id) return `/admin/mecanicos/${row.mecanico_id}`
  return mode === 'admin' ? '/admin/pendencias' : '/mechanic/pendencias'
}

export async function listPendings(
  client: SupabaseClient,
  mode: PendingMode,
): Promise<PendingListItem[]> {
  const rows = await queryRows(
    client
      .from('vw_pendencias_operacionais')
      .select('*')
      .eq('status', 'aberta'),
  )

  const severityOrder = { critica: 0, atencao: 1, baixa: 2 }

  return rows
    .map((row): PendingListItem => ({
        key: row.chave,
        manualId: row.origem === 'manual' ? String(row.chave).replace('manual:', '') : null,
        origin: row.origem,
        severity: row.severidade,
        type: row.tipo,
        vehicleId: row.veiculo_id ?? null,
        driverId: row.motorista_id ?? null,
        mechanicId: row.mecanico_id ?? null,
        serviceId: row.servico_id ?? null,
        maintenanceId: row.manutencao_id ?? null,
        title: row.titulo,
        description: row.descricao ?? '',
        dueDate: row.vencimento_em ?? null,
        dueKm: row.vencimento_km == null ? null : toNumber(row.vencimento_km),
        currentKm: row.km_atual == null ? null : toNumber(row.km_atual),
        status: row.status,
        actionLabel: row.acao_label,
        contextLabel: row.descricao ?? '',
        href: pendingHref(row, mode),
      }))
    .sort((a, b) => (
      (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
      || a.title.localeCompare(b.title, 'pt-BR')
    ))
}

export async function listPendingFormOptions(
  client: SupabaseClient,
  currentMechanicId: string | null = null,
): Promise<PendingFormOptions> {
  const [vehicles, drivers, mechanics, services, maintenances] = await Promise.all([
    queryRows(
      client
        .from('veiculos')
        .select('id,placa,marca,modelo')
        .is('excluido_em', null)
        .order('placa'),
    ),
    queryRows(
      client
        .from('motoristas')
        .select('id,perfil_id')
        .is('excluido_em', null),
    ),
    queryRows(
      client
        .from('mecanicos')
        .select('id,perfil_id')
        .is('excluido_em', null),
    ),
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
        .from('vw_manutencoes_detalhadas')
        .select('id,veiculo_placa,causa,status')
        .in('status', ['aberta', 'em_andamento'])
        .order('aberto_em', { ascending: false }),
    ),
  ])

  const profileIds = [
    ...drivers.map((driver) => driver.perfil_id),
    ...mechanics.map((mechanic) => mechanic.perfil_id),
  ].filter(Boolean)
  const profiles = profileIds.length
    ? await queryRows(client.from('perfis').select('id,nome').in('id', profileIds))
    : []
  const profileById = new Map(profiles.map((profile) => [profile.id, profile.nome]))

  return {
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: `${vehicle.placa} · ${vehicle.marca} ${vehicle.modelo}`,
    })),
    drivers: drivers.flatMap((driver) => {
      const name = profileById.get(driver.perfil_id)
      return name ? [{ id: driver.id, label: name }] : []
    }),
    mechanics: mechanics.flatMap((mechanic) => {
      const name = profileById.get(mechanic.perfil_id)
      return name ? [{ id: mechanic.id, label: name }] : []
    }),
    services: services.map((service) => ({ id: service.id, label: service.nome })),
    maintenances: maintenances.map((maintenance) => ({
      id: maintenance.id,
      label: `${maintenance.veiculo_placa} · ${maintenance.causa || 'Sem descrição'}`,
    })),
    currentMechanicId,
  }
}
