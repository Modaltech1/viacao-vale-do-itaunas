import { NextRequest, NextResponse } from 'next/server'
import {
  parseConcludeTripPayload,
  tripErrorResponse,
} from '@/lib/trips-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  let payload
  try {
    payload = parseConcludeTripPayload(await request.json())
  } catch (error) {
    return tripErrorResponse(error, 'Dados de encerramento inválidos.')
  }

  try {
    const [{ data: trip, error: tripError }, { data: refueling }] = await Promise.all([
      auth.supabase
        .from('viagens')
        .select('km_inicial,saiu_em,status')
        .eq('id', id)
        .single<{ km_inicial: number; saiu_em: string; status: string }>(),
      auth.supabase
        .from('abastecimentos')
        .select('km_registrado')
        .eq('viagem_id', id)
        .is('cancelado_em', null)
        .order('km_registrado', { ascending: false })
        .limit(1)
        .maybeSingle<{ km_registrado: number }>(),
    ])

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Viagem não encontrada.' }, { status: 404 })
    }
    if (trip.status !== 'em_andamento') {
      return NextResponse.json(
        { error: 'Somente uma viagem em andamento pode ser concluída.' },
        { status: 409 },
      )
    }

    const minimumKm = Math.max(Number(trip.km_inicial), Number(refueling?.km_registrado ?? 0))
    if (payload.finalKm < minimumKm) {
      return NextResponse.json(
        { error: `O KM final não pode ser menor que o último KM registrado (${minimumKm}).` },
        { status: 400 },
      )
    }
    if (new Date(payload.finishedAt) < new Date(trip.saiu_em)) {
      return NextResponse.json(
        { error: 'A chegada não pode ocorrer antes da saída.' },
        { status: 400 },
      )
    }

    const { error } = await auth.supabase.rpc('fn_concluir_viagem', {
      p_viagem_id: id,
      p_km_final: payload.finalKm,
      p_chegou_em: payload.finishedAt,
      p_observacoes: payload.notes,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return tripErrorResponse(error, 'Não foi possível concluir a viagem.')
  }
}
