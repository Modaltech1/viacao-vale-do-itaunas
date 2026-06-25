import { NextRequest, NextResponse } from 'next/server'
import { getSinisterDetails } from '@/lib/sinisters-repository'
import {
  parseSinisterPayload,
  saveSinister,
  sinisterErrorResponse,
} from '@/lib/sinisters-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await context.params
    const result = await getSinisterDetails(auth.supabase, id)
    if (!result.sinister) {
      return NextResponse.json({ error: 'Sinistro não encontrado.' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    return sinisterErrorResponse(error, 'Não foi possível carregar o sinistro.', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  let payload
  try {
    payload = parseSinisterPayload(await request.json())
  } catch (error) {
    return sinisterErrorResponse(error, 'Dados do sinistro inválidos.')
  }

  try {
    await saveSinister(auth.supabase, id, payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return sinisterErrorResponse(error, 'Não foi possível atualizar o sinistro.')
  }
}
