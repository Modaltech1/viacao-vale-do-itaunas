import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows, type DatabaseRow } from '@/lib/supabase-query'
import { vehicleLabel } from '@/lib/vehicle-label'
import type {
  MechanicDetails,
  MechanicListItem,
  MechanicMaintenance,
} from '@/types/mechanic'

function maintenanceIdsByMechanic(
  mechanicId: string,
  maintenances: DatabaseRow[],
  assignments: DatabaseRow[],
) {
  return new Set([
    ...maintenances
      .filter((maintenance) => maintenance.mecanico_responsavel_id === mechanicId)
      .map((maintenance) => maintenance.id),
    ...assignments
      .filter((assignment) => assignment.mecanico_id === mechanicId)
      .map((assignment) => assignment.manutencao_id),
  ])
}

function maintenanceRole(
  mechanicId: string,
  maintenance: DatabaseRow,
  assignments: DatabaseRow[],
): 'responsavel' | 'apoio' {
  if (maintenance.mecanico_responsavel_id === mechanicId) return 'responsavel'

  return assignments.find(
    (assignment) =>
      assignment.mecanico_id === mechanicId
      && assignment.manutencao_id === maintenance.id,
  )?.papel === 'responsavel'
    ? 'responsavel'
    : 'apoio'
}

async function loadMechanicRelations(service: SupabaseClient) {
  const [maintenances, assignments] = await Promise.all([
    queryRows(
      service
        .from('vw_manutencoes_detalhadas')
        .select(
          'id,veiculo_id,veiculo_codigo_frota,veiculo_placa,veiculo_marca,veiculo_modelo,tipo_manutencao,causa,aberto_em,iniciado_em,concluido_em,status,valor_total_realizado,mecanico_responsavel_id',
        )
        .order('aberto_em', { ascending: false }),
    ),
    queryRows(
      service
        .from('manutencao_mecanicos')
        .select('manutencao_id,mecanico_id,papel'),
    ),
  ])

  return { maintenances, assignments }
}

export async function listMechanics(service: SupabaseClient): Promise<MechanicListItem[]> {
  const mechanics = await queryRows(
    service
      .from('mecanicos')
      .select('*')
      .is('excluido_em', null)
      .order('criado_em', { ascending: false }),
  )

  if (!mechanics.length) return []

  const profileIds = mechanics.map((mechanic) => mechanic.perfil_id).filter(Boolean)
  const [profiles, relations] = await Promise.all([
    queryRows(service.from('perfis').select('id,nome,email,telefone,ativo').in('id', profileIds)),
    loadMechanicRelations(service),
  ])
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))

  return mechanics.map((mechanic) => {
    const profile = profileById.get(mechanic.perfil_id) ?? {}
    const maintenanceIds = maintenanceIdsByMechanic(
      mechanic.id,
      relations.maintenances,
      relations.assignments,
    )
    const mechanicMaintenances = relations.maintenances.filter((maintenance) =>
      maintenanceIds.has(maintenance.id),
    )

    return {
      id: mechanic.id,
      profileId: mechanic.perfil_id,
      name: profile.nome ?? 'Mecânico sem nome',
      email: profile.email ?? '',
      phone: profile.telefone ?? '',
      specialty: mechanic.especialidade ?? '',
      professionalStatus: mechanic.status_profissional,
      accessActive: Boolean(profile.ativo),
      notes: mechanic.observacoes ?? '',
      maintenancesCount: mechanicMaintenances.length,
      openMaintenancesCount: mechanicMaintenances.filter(
        (maintenance) => maintenance.status === 'aberta' || maintenance.status === 'em_andamento',
      ).length,
      completedMaintenancesCount: mechanicMaintenances.filter(
        (maintenance) => maintenance.status === 'concluida',
      ).length,
      totalValue: mechanicMaintenances.reduce(
        (total, maintenance) => total + toNumber(maintenance.valor_total_realizado),
        0,
      ),
    }
  })
}

export async function getMechanicDetails(
  service: SupabaseClient,
  mechanicId: string,
): Promise<MechanicDetails | null> {
  const mechanics = await listMechanics(service)
  const mechanic = mechanics.find((item) => item.id === mechanicId)
  if (!mechanic) return null

  const relations = await loadMechanicRelations(service)
  const maintenanceIds = maintenanceIdsByMechanic(
    mechanicId,
    relations.maintenances,
    relations.assignments,
  )

  const maintenances: MechanicMaintenance[] = relations.maintenances
    .filter((maintenance) => maintenanceIds.has(maintenance.id))
    .map((maintenance) => ({
      id: maintenance.id,
      vehicleId: maintenance.veiculo_id,
      vehicle: vehicleLabel({
        codigo_frota: maintenance.veiculo_codigo_frota,
        placa: maintenance.veiculo_placa,
        marca: maintenance.veiculo_marca,
        modelo: maintenance.veiculo_modelo,
      }),
      maintenanceType: maintenance.tipo_manutencao,
      cause: maintenance.causa ?? '',
      openedAt: maintenance.aberto_em,
      startedAt: maintenance.iniciado_em,
      completedAt: maintenance.concluido_em,
      status: maintenance.status,
      value: toNumber(maintenance.valor_total_realizado),
      role: maintenanceRole(mechanicId, maintenance, relations.assignments),
    }))

  return { ...mechanic, maintenances }
}
