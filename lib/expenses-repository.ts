import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/driver-utils'
import { queryRows } from '@/lib/supabase-query'
import { getTravelOperationLookups } from '@/lib/travel-operation-repository'
import type {
  ExpenseListItem,
  ExpenseLookups,
} from '@/types/expense'

export async function listExpenses(
  supabase: SupabaseClient,
): Promise<{ items: ExpenseListItem[]; lookups: ExpenseLookups }> {
  const [expenses, lookups] = await Promise.all([
    queryRows(
      supabase
        .from('despesas_viagem')
        .select('id,viagem_id,motorista_id,veiculo_id,categoria,valor,registrado_em,observacoes,comprovante_path')
        .is('cancelado_em', null)
        .order('registrado_em', { ascending: false }),
    ),
    getTravelOperationLookups(supabase),
  ])

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
    })),
    lookups,
  }
}
