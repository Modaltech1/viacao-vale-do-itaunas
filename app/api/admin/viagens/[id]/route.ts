import { NextRequest, NextResponse } from 'next/server'
import { getTripDetails, getTripFormOptions } from '@/lib/trips-repository'
import {
  parseUpdateTripPayload,
  tripErrorResponse,
} from '@/lib/trips-service'
import { assertAdminTripAccess } from '@/lib/admin-scope-server'
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params

  try {
    const [trip, options] = await Promise.all([
      getTripDetails(auth.supabase, id),
      getTripFormOptions(auth.supabase),
    ])
    if (!trip) return NextResponse.json({ error: 'Viagem não encontrada.' }, { status: 404 })
    return NextResponse.json({ trip, options })
  } catch (error) {
    return tripErrorResponse(error, 'Não foi possível carregar a viagem.', 500)
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
    payload = parseUpdateTripPayload(await request.json())
  } catch (error) {
    return tripErrorResponse(error, 'Dados da viagem inválidos.')
  }

  const service = createSupabaseServiceClient()

  try {
    await assertAdminTripAccess(auth.supabase, auth.admin, id)

    const { data: current, error: currentError } = await service
      .from('viagens')
      .select('id,status,km_final,chegou_em')
      .eq('id', id)
      .single<{ id: string; status: string; km_final: number | null; chegou_em: string | null }>()

    if (currentError || !current) {
      return NextResponse.json({ error: 'Viagem não encontrada.' }, { status: 404 })
    }
    if (current.status === 'cancelada') {
      return NextResponse.json(
        { error: 'Viagens canceladas não podem ser alteradas.' },
        { status: 409 },
      )
    }

    if (current.status === 'concluida') {
      const finalKm = payload.finalKm ?? current.km_final
      const finishedAt = payload.finishedAt ?? current.chegou_em

      if (finalKm == null || !finishedAt) {
        return NextResponse.json(
          { error: 'KM final e chegada são obrigatórios para corrigir uma viagem concluída.' },
          { status: 400 },
        )
      }

      const { error } = await auth.supabase.rpc('fn_corrigir_viagem_concluida', {
        p_viagem_id: id,
        p_km_final: finalKm,
        p_chegou_em: finishedAt,
        p_origem: payload.origin,
        p_destino: payload.destination,
        p_observacoes: payload.notes,
      })

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    const { error } = await service
      .from('viagens')
      .update({
        origem_snapshot: payload.origin,
        destino_snapshot: payload.destination,
        observacoes: payload.notes,
        atualizado_por: auth.user.id,
      })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return tripErrorResponse(error, 'Não foi possível atualizar a viagem.')
  }
}
