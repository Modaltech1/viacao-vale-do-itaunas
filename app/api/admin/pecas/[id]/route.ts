import { NextRequest, NextResponse } from 'next/server'
import {
  parsePartPayload,
  partErrorResponse,
  savePart,
} from '@/lib/parts-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await context.params
    const payload = parsePartPayload(await request.json())
    await savePart(auth.supabase, id, payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return partErrorResponse(error, 'Não foi possível atualizar a peça.')
  }
}
