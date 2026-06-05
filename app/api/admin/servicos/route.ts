import { NextRequest, NextResponse } from 'next/server'
import { listServices } from '@/lib/services-repository'
import {
  parseServicePayload,
  serviceErrorResponse,
  servicePayloadToDatabase,
} from '@/lib/services-service'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json({ items: await listServices(auth.supabase) })
  } catch (error) {
    return serviceErrorResponse(error, 'Não foi possível carregar os serviços.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let payload
  try {
    payload = parseServicePayload(await request.json())
  } catch (error) {
    return serviceErrorResponse(error, 'Dados do serviço inválidos.')
  }

  const service = createSupabaseServiceClient()

  try {
    const { data, error } = await service
      .from('servicos')
      .insert({
        ...servicePayloadToDatabase(payload),
        criado_por: auth.user.id,
        atualizado_por: auth.user.id,
      })
      .select('id')
      .single<{ id: string }>()

    if (error || !data) throw error ?? new Error('Não foi possível criar o serviço.')
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
  } catch (error) {
    return serviceErrorResponse(error, 'Não foi possível criar o serviço.')
  }
}
