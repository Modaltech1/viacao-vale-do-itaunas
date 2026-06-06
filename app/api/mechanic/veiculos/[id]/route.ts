import { NextRequest, NextResponse } from 'next/server'
import { getVehicleDetails } from '@/lib/vehicles-repository'
import { vehicleErrorResponse } from '@/lib/vehicles-service'
import { requireMechanic } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireMechanic()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  try {
    const vehicle = await getVehicleDetails(auth.supabase, id, 'mechanic')
    if (!vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ vehicle })
  } catch (error) {
    return vehicleErrorResponse(error, 'Não foi possível carregar o veículo.', 500)
  }
}
