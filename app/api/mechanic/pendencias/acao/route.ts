import { NextRequest, NextResponse } from 'next/server'
import {
  interactWithPending,
  pendingErrorResponse,
} from '@/lib/pendings-service'
import {
  requireMechanic,
} from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const auth = await requireMechanic()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    await interactWithPending(auth.supabase, {
      key: String(body.key ?? ''),
      origin: body.origin,
      action: body.action,
      comment: String(body.comment ?? ''),
      userId: auth.user.id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return pendingErrorResponse(error, 'Não foi possível atualizar a pendência.')
  }
}
