import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminAccess } from '@/lib/admin-scope'
import { assertAdminVehicleAccess } from '@/lib/admin-scope-server'
import { apiErrorResponse } from '@/lib/error-response'
import { getGatewayPocTerminalId } from '@/lib/videotelemetry-gateway'
import {
  getCurrentVehicleVideotelemetryDevice,
  getLatestVehicleVideotelemetryDevice,
} from '@/lib/videotelemetry-repository'

function domainError(message: string, status: number) {
  const error = new Error(message)
  Object.assign(error, { status })
  return error
}

export async function getAuthorizedVehicleVideotelemetryDevice(
  client: SupabaseClient,
  access: AdminAccess,
  vehicleId: string,
) {
  await assertAdminVehicleAccess(client, access, vehicleId)
  return getCurrentVehicleVideotelemetryDevice(client, vehicleId)
}

export async function requireControllableVehicleVideotelemetry(
  client: SupabaseClient,
  access: AdminAccess,
  vehicleId: string,
) {
  await assertAdminVehicleAccess(client, access, vehicleId)

  const device = await getCurrentVehicleVideotelemetryDevice(client, vehicleId)
  if (!device) {
    const latestDevice = await getLatestVehicleVideotelemetryDevice(client, vehicleId)
    if (latestDevice?.deletedAt) {
      throw domainError('O dispositivo de videotelemetria deste veículo foi removido.', 409)
    }
    throw domainError('Nenhum dispositivo de videotelemetria está vinculado a este veículo.', 404)
  }

  if (!device.active) {
    throw domainError('O dispositivo de videotelemetria deste veículo está inativo.', 409)
  }
  if (!device.terminalId.trim()) {
    throw domainError('O dispositivo não possui um terminal de videotelemetria válido.', 409)
  }
  if (device.terminalId !== getGatewayPocTerminalId()) {
    throw domainError('O Gateway ainda não foi habilitado para o terminal deste veículo.', 409)
  }

  return device
}

export function assertVideotelemetryChannel(
  channels: { number: number }[],
  requestedChannel: number,
) {
  if (!channels.some((channel) => channel.number === requestedChannel)) {
    throw domainError('O canal selecionado não está cadastrado neste dispositivo.', 400)
  }
}

export function videotelemetryErrorResponse(
  error: unknown,
  fallback: string,
  status = 400,
) {
  return apiErrorResponse(error, fallback, status)
}
