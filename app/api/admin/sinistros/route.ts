import { NextRequest, NextResponse } from 'next/server'
import { listSinisters } from '@/lib/sinisters-repository'
import {
  parseSinisterPayload,
  saveSinister,
  sinisterErrorResponse,
} from '@/lib/sinisters-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(await listSinisters(auth.supabase))
  } catch (error) {
    return sinisterErrorResponse(error, 'Não foi possível carregar os sinistros.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let payload
  try {
    payload = parseSinisterPayload(await request.json())
  } catch (error) {
    return sinisterErrorResponse(error, 'Dados do sinistro inválidos.')
  }

  try {
    const id = await saveSinister(auth.supabase, null, payload)
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return sinisterErrorResponse(error, 'Não foi possível criar o sinistro.')
  }
}
