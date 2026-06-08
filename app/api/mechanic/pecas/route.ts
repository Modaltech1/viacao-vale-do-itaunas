import { NextResponse } from 'next/server'
import { listParts } from '@/lib/parts-repository'
import { partErrorResponse } from '@/lib/parts-service'
import { requireMechanic } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireMechanic()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json({ items: await listParts(auth.supabase) })
  } catch (error) {
    return partErrorResponse(error, 'Não foi possível carregar as peças.', 500)
  }
}
