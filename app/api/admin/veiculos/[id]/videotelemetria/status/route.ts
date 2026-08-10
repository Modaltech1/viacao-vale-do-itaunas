import { NextRequest, NextResponse } from 'next/server'
import { getGatewayStatus } from '@/lib/videotelemetry-gateway'
import {
  requireControllableVehicleVideotelemetry,
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
    await requireControllableVehicleVideotelemetry(auth.supabase, auth.admin, id)
    const live = await getGatewayStatus()
    return NextResponse.json({ live })
  } catch (error) {
    return videotelemetryErrorResponse(
      error,
      'Não foi possível consultar a transmissão.',
      500,
    )
  }
}
