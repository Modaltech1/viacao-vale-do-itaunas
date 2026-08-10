import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseVideotelemetryChannels } from '@/lib/videotelemetry-domain'
import type { VideotelemetryDevice } from '@/types/videotelemetry'

type VideotelemetryDeviceRow = {
  id: string
  veiculo_id: string
  terminal_id: string
  modelo: string
  canais: unknown
  ativo: boolean
  excluido_em: string | null
}

function normalizeDevice(row: VideotelemetryDeviceRow): VideotelemetryDevice {
  return {
    id: row.id,
    vehicleId: row.veiculo_id,
    terminalId: row.terminal_id,
    model: row.modelo,
    channels: parseVideotelemetryChannels(row.canais),
    active: row.ativo,
    deletedAt: row.excluido_em,
  }
}

export async function getCurrentVehicleVideotelemetryDevice(
  client: SupabaseClient,
  vehicleId: string,
) {
  const { data, error } = await client
    .from('dispositivos_videotelemetria')
    .select('id,veiculo_id,terminal_id,modelo,canais,ativo,excluido_em')
    .eq('veiculo_id', vehicleId)
    .is('excluido_em', null)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle<VideotelemetryDeviceRow>()

  if (error) throw error
  return data ? normalizeDevice(data) : null
}

export async function getLatestVehicleVideotelemetryDevice(
  client: SupabaseClient,
  vehicleId: string,
) {
  const { data, error } = await client
    .from('dispositivos_videotelemetria')
    .select('id,veiculo_id,terminal_id,modelo,canais,ativo,excluido_em')
    .eq('veiculo_id', vehicleId)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle<VideotelemetryDeviceRow>()

  if (error) throw error
  return data ? normalizeDevice(data) : null
}
