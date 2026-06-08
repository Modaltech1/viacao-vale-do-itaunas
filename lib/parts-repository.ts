import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import type { PartListItem } from '@/types/part'

export async function listParts(client: SupabaseClient): Promise<PartListItem[]> {
  const [parts, maintenanceUsages, expenseUsages] = await Promise.all([
    queryRows(
      client
        .from('pecas')
        .select('id,codigo,nome,categoria,unidade_medida,quantidade_estoque,estoque_minimo,valor_unitario,descricao,ativo')
        .is('excluido_em', null)
        .order('nome'),
    ),
    queryRows(
      client
        .from('manutencao_pecas')
        .select('peca_id,quantidade,estoque_devolvido_em'),
    ),
    queryRows(
      client
        .from('despesa_pecas')
        .select('peca_id,quantidade,estoque_devolvido_em'),
    ),
  ])

  return parts.map((part) => {
    const partMaintenanceUsages = maintenanceUsages.filter(
      (usage) => usage.peca_id === part.id && !usage.estoque_devolvido_em,
    )
    const partExpenseUsages = expenseUsages.filter(
      (usage) => usage.peca_id === part.id && !usage.estoque_devolvido_em,
    )
    const partUsages = [...partMaintenanceUsages, ...partExpenseUsages]
    const stockQuantity = toNumber(part.quantidade_estoque)
    const unitValue = toNumber(part.valor_unitario)

    return {
      id: part.id,
      code: part.codigo,
      name: part.nome,
      category: part.categoria,
      unit: part.unidade_medida,
      stockQuantity,
      minimumStock: toNumber(part.estoque_minimo),
      unitValue,
      stockValue: stockQuantity * unitValue,
      description: part.descricao ?? '',
      active: Boolean(part.ativo),
      maintenanceUsesCount: partMaintenanceUsages.length,
      expenseUsesCount: partExpenseUsages.length,
      consumedQuantity: partUsages.reduce(
        (total, usage) => total + toNumber(usage.quantidade),
        0,
      ),
    }
  })
}
