import { NextRequest, NextResponse } from 'next/server'
import {
  listPendingFormOptions,
  listPendings,
} from '@/lib/pendings-repository'
import {
  createManualPending,
  parsePendingPayload,
  pendingErrorResponse,
} from '@/lib/pendings-service'
import {
  requireMechanic,
} from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireMechanic()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const [items, options] = await Promise.all([
      listPendings(auth.supabase, 'mechanic'),
      listPendingFormOptions(auth.supabase, auth.mechanic.id),
    ])
    return NextResponse.json({ items, options })
  } catch (error) {
    return pendingErrorResponse(error, 'Não foi possível carregar as pendências.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMechanic()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const payload = parsePendingPayload(await request.json(), auth.mechanic.id)
    const id = await createManualPending(
      auth.supabase,
      payload,
      auth.user.id,
    )
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return pendingErrorResponse(error, 'Não foi possível criar a pendência.')
  }
}
