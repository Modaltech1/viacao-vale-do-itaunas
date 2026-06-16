import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import { getTravelOperationLookups } from '@/lib/travel-operation-repository'
import { vehicleLabel } from '@/lib/vehicle-label'
import type {
  ExpenseListItem,
  ExpenseLookups,
  MaintenanceExpenseItem,
} from '@/types/expense'

export async function listExpenses(
  supabase: SupabaseClient,
): Promise<{
  items: ExpenseListItem[]
  maintenanceItems: MaintenanceExpenseItem[]
  lookups: ExpenseLookups
}> {
  const [expenses, expenseParts, maintenances, parts, baseLookups] = await Promise.all([
    queryRows(
      supabase
        .from('despesas_viagem')
        .select('id,viagem_id,motorista_id,veiculo_id,categoria,valor,registrado_em,observacoes,comprovante_path')
        .is('cancelado_em', null)
        .order('registrado_em', { ascending: false }),
    ),
    queryRows(
      supabase
        .from('despesa_pecas')
        .select('id,despesa_id,peca_id,codigo_snapshot,nome_snapshot,unidade_snapshot,quantidade,valor_unitario,valor_total,estoque_devolvido_em')
        .order('criado_em', { ascending: true }),
    ),
    queryRows(
      supabase
        .from('vw_manutencoes_detalhadas')
        .select('id,veiculo_id,veiculo_codigo_frota,veiculo_placa,veiculo_marca,veiculo_modelo,causa,aberto_em,status,valor_total_realizado,pecas')
        .neq('status', 'cancelada')
        .order('aberto_em', { ascending: false }),
    ),
    queryRows(
      supabase
        .from('pecas')
        .select('id,codigo,nome,unidade_medida,quantidade_estoque,valor_unitario')
        .eq('ativo', true)
        .is('excluido_em', null)
        .order('nome', { ascending: true }),
    ),
    getTravelOperationLookups(supabase),
  ])

  const lookups: ExpenseLookups = {
    ...baseLookups,
    parts: parts.map((part) => ({
      id: part.id,
      code: part.codigo,
      name: part.nome,
      unit: part.unidade_medida,
      stockQuantity: toNumber(part.quantidade_estoque),
      unitValue: toNumber(part.valor_unitario),
    })),
  }
  const vehicleById = new Map(lookups.vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const driverById = new Map(lookups.drivers.map((driver) => [driver.id, driver]))

  return {
    items: expenses.map((expense) => ({
      id: expense.id,
      tripId: expense.viagem_id ?? null,
      vehicleId: expense.veiculo_id,
      vehicleLabel: vehicleById.get(expense.veiculo_id)?.label ?? 'Veículo não encontrado',
      driverId: expense.motorista_id ?? null,
      driverName: expense.motorista_id
        ? driverById.get(expense.motorista_id)?.name ?? 'Motorista não encontrado'
        : 'Sem motorista',
      category: expense.categoria,
      value: toNumber(expense.valor),
      registeredAt: expense.registrado_em,
      notes: expense.observacoes ?? '',
      receiptPath: expense.comprovante_path ?? '',
      parts: expenseParts
        .filter((part) => part.despesa_id === expense.id)
        .map((part) => ({
          id: part.id,
          partId: part.peca_id,
          code: part.codigo_snapshot,
          name: part.nome_snapshot,
          unit: part.unidade_snapshot,
          quantity: toNumber(part.quantidade),
          unitValue: toNumber(part.valor_unitario),
          totalValue: toNumber(part.valor_total),
          returnedAt: part.estoque_devolvido_em ?? null,
        })),
    })),
    maintenanceItems: maintenances.map((maintenance) => ({
      id: maintenance.id,
      vehicleId: maintenance.veiculo_id,
      vehicleLabel: vehicleLabel({
        codigo_frota: maintenance.veiculo_codigo_frota,
        placa: maintenance.veiculo_placa,
        marca: maintenance.veiculo_marca,
        modelo: maintenance.veiculo_modelo,
      }),
      cause: maintenance.causa ?? '',
      registeredAt: maintenance.aberto_em,
      value: toNumber(maintenance.valor_total_realizado),
      partsCount: Array.isArray(maintenance.pecas) ? maintenance.pecas.length : 0,
      status: maintenance.status,
    })),
    lookups,
  }
}
