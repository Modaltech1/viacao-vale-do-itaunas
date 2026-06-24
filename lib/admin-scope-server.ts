import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminAccess } from '@/lib/admin-scope'

type ScopedTable = 'veiculos' | 'motoristas'

export async function adminCanAccessRecord(
  client: SupabaseClient,
  access: AdminAccess,
  table: ScopedTable,
  recordId: string,
) {
  if (access.isGlobal) return true

  const { data, error } = await client
    .from(table)
    .select('id')
    .eq('id', recordId)
    .eq('admin_responsavel_id', access.userId)
    .is('excluido_em', null)
    .maybeSingle<{ id: string }>()

  if (error) throw error
  return Boolean(data)
}

export async function assertAdminRecordAccess(
  client: SupabaseClient,
  access: AdminAccess,
  table: ScopedTable,
  recordId: string,
  resourceLabel: string,
) {
  if (await adminCanAccessRecord(client, access, table, recordId)) return

  const error = new Error(`${resourceLabel} não encontrado.`)
  Object.assign(error, { status: 404 })
  throw error
}

export async function assertAdminVehicleAccess(
  client: SupabaseClient,
  access: AdminAccess,
  vehicleId: string,
) {
  return assertAdminRecordAccess(client, access, 'veiculos', vehicleId, 'Veículo')
}

export async function assertAdminDriverAccess(
  client: SupabaseClient,
  access: AdminAccess,
  driverId: string,
) {
  return assertAdminRecordAccess(client, access, 'motoristas', driverId, 'Motorista')
}

export async function assertAdminTripAccess(
  client: SupabaseClient,
  access: AdminAccess,
  tripId: string,
) {
  if (access.isGlobal) return

  const { data, error } = await client
    .from('viagens')
    .select('veiculo_id')
    .eq('id', tripId)
    .maybeSingle<{ veiculo_id: string }>()

  if (error) throw error
  if (!data) {
    const notFound = new Error('Viagem não encontrada.')
    Object.assign(notFound, { status: 404 })
    throw notFound
  }

  await assertAdminVehicleAccess(client, access, data.veiculo_id)
}

export async function assertAdminMaintenanceAccess(
  client: SupabaseClient,
  access: AdminAccess,
  maintenanceId: string,
) {
  if (access.isGlobal) return

  const { data, error } = await client
    .from('manutencoes')
    .select('veiculo_id')
    .eq('id', maintenanceId)
    .maybeSingle<{ veiculo_id: string }>()

  if (error) throw error
  if (!data) {
    const notFound = new Error('Manutenção não encontrada.')
    Object.assign(notFound, { status: 404 })
    throw notFound
  }

  await assertAdminVehicleAccess(client, access, data.veiculo_id)
}
