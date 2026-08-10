import { NextRequest, NextResponse } from 'next/server'
import { parseVideotelemetryChannelNumber } from '@/lib/videotelemetry-domain'
import {
  startGatewayLive,
  stopGatewayLive,
} from '@/lib/videotelemetry-gateway'
import {
  assertVideotelemetryChannel,
  requireControllableVehicleVideotelemetry,
  videotelemetryErrorResponse,
} from '@/lib/videotelemetry-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  try {
    const body = await request.json() as Record<string, unknown>
    const channel = parseVideotelemetryChannelNumber(body.channel)
    const device = await requireControllableVehicleVideotelemetry(
      auth.supabase,
      auth.admin,
      id,
    )
    assertVideotelemetryChannel(device.channels, channel)

    const live = await startGatewayLive(channel)
    return NextResponse.json({ live })
  } catch (error) {
    return videotelemetryErrorResponse(
      error,
      'Não foi possível iniciar a transmissão.',
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  try {
    await requireControllableVehicleVideotelemetry(auth.supabase, auth.admin, id)
    const result = await stopGatewayLive()
    return NextResponse.json(result)
  } catch (error) {
    return videotelemetryErrorResponse(
      error,
      'Não foi possível encerrar a transmissão.',
    )
  }
}
