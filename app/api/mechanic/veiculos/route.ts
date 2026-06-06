import { NextResponse } from 'next/server'
import { listVehicles } from '@/lib/vehicles-repository'
import { vehicleErrorResponse } from '@/lib/vehicles-service'
import { requireMechanic } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireMechanic()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const items = await listVehicles(auth.supabase)
    return NextResponse.json({ items })
  } catch (error) {
    return vehicleErrorResponse(error, 'Não foi possível carregar os veículos.', 500)
  }
}
