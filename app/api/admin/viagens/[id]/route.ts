import { NextRequest, NextResponse } from 'next/server'
import { getTripDetails, getTripFormOptions } from '@/lib/trips-repository'
import {
  parseUpdateTripPayload,
  tripErrorResponse,
} from '@/lib/trips-service'
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
    const { data: current, error: currentError } = await service
      .from('viagens')
      .select('id,status')
      .eq('id', id)
      .single<{ id: string; status: string }>()

    if (currentError || !current) {
      return NextResponse.json({ error: 'Viagem não encontrada.' }, { status: 404 })
    }
    if (current.status === 'cancelada') {
      return NextResponse.json(
        { error: 'Viagens canceladas não podem ser alteradas.' },
        { status: 409 },
      )
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
