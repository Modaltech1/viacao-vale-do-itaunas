import { NextRequest, NextResponse } from 'next/server'
import { listParts } from '@/lib/parts-repository'
import {
  parsePartPayload,
  partErrorResponse,
  savePart,
} from '@/lib/parts-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json({ items: await listParts(auth.supabase) })
  } catch (error) {
    return partErrorResponse(error, 'Não foi possível carregar as peças.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const payload = parsePartPayload(await request.json())
    const id = await savePart(auth.supabase, null, payload)
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return partErrorResponse(error, 'Não foi possível cadastrar a peça.')
  }
}
