import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export async function resolveTripRelation(
  service: SupabaseClient,
  tripId: string | null,
) {
  if (!tripId) return undefined

  const { data, error } = await service
    .from('viagens')
    .select('veiculo_id,motorista_id')
    .eq('id', tripId)
    .neq('status', 'cancelada')
    .single<{ veiculo_id: string; motorista_id: string }>()

  if (error || !data) throw new Error('Viagem não encontrada.')
  return { vehicleId: data.veiculo_id, driverId: data.motorista_id }
}
