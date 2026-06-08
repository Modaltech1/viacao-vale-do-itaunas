import { NextRequest, NextResponse } from 'next/server'
import {
  cancelMaintenance,
  concludeMaintenance,
  maintenanceErrorResponse,
} from '@/lib/maintenances-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await context.params

  try {
    const body = await request.json()
    if (body.action === 'conclude') {
      await concludeMaintenance(auth.supabase, id)
    } else if (body.action === 'cancel') {
      await cancelMaintenance(
        auth.supabase,
        id,
        String(body.reason ?? ''),
      )
    } else {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return maintenanceErrorResponse(error, 'Não foi possível executar a ação.')
  }
}
