import { NextResponse } from 'next/server'
import { listServices } from '@/lib/services-repository'
import { serviceErrorResponse } from '@/lib/services-service'
import { requireMechanic } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireMechanic()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const items = await listServices(auth.supabase)
    return NextResponse.json({ items: items.filter((service) => service.active) })
  } catch (error) {
    return serviceErrorResponse(error, 'Não foi possível carregar os serviços.', 500)
  }
}
