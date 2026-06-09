import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { queryRows } from '@/lib/supabase-query'
import { toNumber } from '@/lib/driver-utils'
import type { ServiceListItem } from '@/types/service'

export async function listServices(service: SupabaseClient): Promise<ServiceListItem[]> {
  const services = await queryRows(
    service
      .from('servicos')
      .select('id,nome,categoria,tipo_manutencao_sugerido,tipo_periodicidade,periodicidade_km,periodicidade_dias,valor_padrao,descricao,ativo')
      .is('excluido_em', null)
      .order('nome', { ascending: true }),
  )

  if (!services.length) return []

  const serviceIds = services.map((item) => item.id)
  const [schedules, maintenanceItems] = await Promise.all([
    queryRows(
      service
        .from('veiculo_servico_programacoes')
        .select('servico_id,veiculo_id')
        .in('servico_id', serviceIds)
        .eq('ativo', true)
        .is('excluido_em', null),
    ),
    queryRows(
      service
        .from('manutencao_servicos')
        .select('servico_id')
        .in('servico_id', serviceIds),
    ),
  ])

  return services.map((item) => ({
    id: item.id,
    name: item.nome,
    category: item.categoria,
    suggestedMaintenanceType: item.tipo_manutencao_sugerido,
    periodicityType: item.tipo_periodicidade,
    periodicityKm: item.periodicidade_km == null ? null : toNumber(item.periodicidade_km),
    periodicityDays: item.periodicidade_dias == null ? null : Number(item.periodicidade_dias),
    defaultValue: toNumber(item.valor_padrao),
    description: item.descricao ?? '',
    active: Boolean(item.ativo),
    linkedVehiclesCount: new Set(
      schedules
        .filter((schedule) => schedule.servico_id === item.id)
        .map((schedule) => schedule.veiculo_id),
    ).size,
    maintenanceUsesCount: maintenanceItems.filter(
      (maintenanceItem) => maintenanceItem.servico_id === item.id,
    ).length,
  }))
}
