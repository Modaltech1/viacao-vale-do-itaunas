import { NextResponse } from 'next/server'
import { getDriverPortalData } from '@/lib/driver-portal-repository'
import { driverPortalErrorResponse } from '@/lib/driver-portal-service'
import { requireDriver } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireDriver()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const portal = await getDriverPortalData(auth.supabase, auth.user.id, auth.driver.id)

    if (!portal) {
      return NextResponse.json({ error: 'Cadastro do motorista não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ portal })
  } catch (error) {
    return driverPortalErrorResponse(error, 'Não foi possível carregar o portal do motorista.', 500)
  }
}
