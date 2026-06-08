import { NextRequest, NextResponse } from 'next/server'
import {
  getMaintenanceDetails,
  listMaintenanceFormOptions,
} from '@/lib/maintenances-repository'
import {
  maintenanceErrorResponse,
  parseMaintenancePayload,
  updateMaintenance,
} from '@/lib/maintenances-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await context.params

  try {
    const [maintenance, options] = await Promise.all([
      getMaintenanceDetails(auth.supabase, id),
      listMaintenanceFormOptions(auth.supabase),
    ])
    if (!maintenance) {
      return NextResponse.json({ error: 'Manutenção não encontrada.' }, { status: 404 })
    }
    return NextResponse.json({ maintenance, options })
  } catch (error) {
    return maintenanceErrorResponse(error, 'Não foi possível carregar a manutenção.', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await context.params

  try {
    const payload = parseMaintenancePayload(await request.json())
    await updateMaintenance(auth.supabase, id, payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return maintenanceErrorResponse(error, 'Não foi possível atualizar a manutenção.')
  }
}
