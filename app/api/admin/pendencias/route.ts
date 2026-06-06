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
  requireAdmin,
} from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const [items, options] = await Promise.all([
      listPendings(auth.supabase, 'admin'),
      listPendingFormOptions(auth.supabase),
    ])
    return NextResponse.json({ items, options })
  } catch (error) {
    return pendingErrorResponse(error, 'Não foi possível carregar as pendências.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const payload = parsePendingPayload(await request.json())
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
