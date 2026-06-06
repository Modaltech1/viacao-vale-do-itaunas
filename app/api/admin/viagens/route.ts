import { NextRequest, NextResponse } from 'next/server'
import { getTripFormOptions, listTrips } from '@/lib/trips-repository'
import {
  parseCreateTripPayload,
  tripErrorResponse,
} from '@/lib/trips-service'
import { requireAdmin } from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const [items, options] = await Promise.all([
      listTrips(auth.supabase),
      getTripFormOptions(auth.supabase),
    ])
    return NextResponse.json({ items, options })
  } catch (error) {
    return tripErrorResponse(error, 'Não foi possível carregar as viagens.', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let payload
  try {
    payload = parseCreateTripPayload(await request.json())
  } catch (error) {
    return tripErrorResponse(error, 'Dados da viagem inválidos.')
  }

  try {
    const [{ data: vehicle, error: vehicleError }, { data: driver, error: driverError }] =
      await Promise.all([
        auth.supabase
          .from('veiculos')
          .select('rota_fixa_id,km_atual,status_operacional')
          .eq('id', payload.vehicleId)
          .is('excluido_em', null)
          .single<{
            rota_fixa_id: string | null
            km_atual: number
            status_operacional: string
          }>(),
        auth.supabase
          .from('motoristas')
          .select('id,status_profissional')
          .eq('id', payload.driverId)
          .is('excluido_em', null)
          .single<{ id: string; status_profissional: string }>(),
      ])

    if (vehicleError || !vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
    }
    if (driverError || !driver || driver.status_profissional !== 'ativo') {
      return NextResponse.json({ error: 'Motorista ativo não encontrado.' }, { status: 404 })
    }
    if (['em_manutencao', 'inativo', 'indisponivel'].includes(vehicle.status_operacional)) {
      return NextResponse.json(
        { error: 'O veículo selecionado não está disponível para iniciar uma viagem.' },
        { status: 409 },
      )
    }
    if (payload.initialKm < Number(vehicle.km_atual)) {
      return NextResponse.json(
        { error: 'O KM inicial não pode ser menor que o KM atual do veículo.' },
        { status: 400 },
      )
    }

    const { data: assignment } = await auth.supabase
      .from('veiculo_motoristas')
      .select('id')
      .eq('veiculo_id', payload.vehicleId)
      .eq('motorista_id', payload.driverId)
      .eq('ativo', true)
      .is('fim_em', null)
      .maybeSingle()

    const { data, error } = await auth.supabase.rpc('fn_iniciar_viagem', {
      p_veiculo_id: payload.vehicleId,
      p_motorista_id: payload.driverId,
      p_rota_id: vehicle.rota_fixa_id,
      p_origem: payload.origin,
      p_destino: payload.destination,
      p_saiu_em: payload.startedAt,
      p_km_inicial: payload.initialKm,
      p_observacoes: payload.notes,
      p_veiculo_temporario: !assignment,
    })

    if (error) throw error
    return NextResponse.json({ ok: true, id: data }, { status: 201 })
  } catch (error) {
    return tripErrorResponse(error, 'Não foi possível iniciar a viagem.')
  }
}
