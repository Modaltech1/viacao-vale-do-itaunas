import { NextRequest, NextResponse } from 'next/server'
import {
  parseServicePayload,
  serviceErrorResponse,
  servicePayloadToDatabase,
} from '@/lib/services-service'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  let payload
  try {
    payload = parseServicePayload(await request.json())
  } catch (error) {
    return serviceErrorResponse(error, 'Dados do serviço inválidos.')
  }

  const service = createSupabaseServiceClient()

  try {
    const { data: currentService, error: currentError } = await service
      .from('servicos')
      .select('id')
      .eq('id', id)
      .is('excluido_em', null)
      .single()

    if (currentError || !currentService) {
      return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 })
    }

    const { error } = await service
      .from('servicos')
      .update({
        ...servicePayloadToDatabase(payload),
        atualizado_por: auth.user.id,
      })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serviceErrorResponse(error, 'Não foi possível atualizar o serviço.')
  }
}
