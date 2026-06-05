import { NextRequest, NextResponse } from 'next/server'
import {
  driverPortalErrorResponse,
  parseStartTripPayload,
} from '@/lib/driver-portal-service'
import { requireDriver } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const auth = await requireDriver()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let payload
  try {
    payload = parseStartTripPayload(await request.json())
  } catch (error) {
    return driverPortalErrorResponse(error, 'Dados da viagem inválidos.')
  }

  try {
    const { data: assignment, error: assignmentError } = await auth.supabase
      .from('veiculo_motoristas')
      .select('tipo_vinculo')
      .eq('motorista_id', auth.driver.id)
      .eq('veiculo_id', payload.vehicleId)
      .eq('ativo', true)
      .is('fim_em', null)
      .single<{ tipo_vinculo: string }>()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: 'Você não possui vínculo ativo com o veículo selecionado.' },
        { status: 403 },
      )
    }

    const { data: vehicle, error: vehicleError } = await auth.supabase
      .from('veiculos')
      .select('rota_fixa_id')
      .eq('id', payload.vehicleId)
      .is('excluido_em', null)
      .single<{ rota_fixa_id: string | null }>()

    if (vehicleError || !vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
    }

    const { data, error } = await auth.supabase.rpc('fn_iniciar_viagem', {
      p_veiculo_id: payload.vehicleId,
      p_motorista_id: null,
      p_rota_id: vehicle.rota_fixa_id,
      p_origem: payload.origin,
      p_destino: payload.destination,
      p_saiu_em: new Date().toISOString(),
      p_km_inicial: payload.initialKm,
      p_observacoes: payload.notes,
      p_veiculo_temporario: assignment.tipo_vinculo === 'temporario',
    })

    if (error) throw error
    return NextResponse.json({ ok: true, id: data }, { status: 201 })
  } catch (error) {
    return driverPortalErrorResponse(error, 'Não foi possível iniciar a viagem.')
  }
}
