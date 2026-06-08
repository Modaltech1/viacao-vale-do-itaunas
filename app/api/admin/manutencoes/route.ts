import { NextRequest, NextResponse } from 'next/server'
import {
  listMaintenanceFormOptions,
  listMaintenances,
} from '@/lib/maintenances-repository'
import {
  createMaintenance,
  maintenanceErrorResponse,
  parseMaintenancePayload,
} from '@/lib/maintenances-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const [items, options] = await Promise.all([
      listMaintenances(auth.supabase),
      listMaintenanceFormOptions(auth.supabase),
    ])
    return NextResponse.json({ items, options })
  } catch (error) {
    return maintenanceErrorResponse(error, 'Não foi possível carregar as manutenções.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const payload = parseMaintenancePayload(await request.json())
    const id = await createMaintenance(auth.supabase, payload)
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return maintenanceErrorResponse(error, 'Não foi possível criar a manutenção.')
  }
}
