import { NextRequest, NextResponse } from 'next/server'
import { toVideotelemetryDeviceView } from '@/lib/videotelemetry-domain'
import {
  getAuthorizedVehicleVideotelemetryDevice,
  videotelemetryErrorResponse,
} from '@/lib/videotelemetry-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  try {
    const device = await getAuthorizedVehicleVideotelemetryDevice(
      auth.supabase,
      auth.admin,
      id,
    )

    return NextResponse.json({
      device: device ? toVideotelemetryDeviceView(device) : null,
    })
  } catch (error) {
    return videotelemetryErrorResponse(
      error,
      'Não foi possível consultar a videotelemetria deste veículo.',
      500,
    )
  }
}
