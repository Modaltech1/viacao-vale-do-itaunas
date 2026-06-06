import { NextRequest, NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/dashboard-repository'
import { requireAdmin } from '@/lib/supabase-server'

function optionalDate(value: string | null) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Período inválido.')
  return value
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const params = request.nextUrl.searchParams
    const startDate = optionalDate(params.get('inicio'))
    const endDate = optionalDate(params.get('fim'))

    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { error: 'A data inicial não pode ser posterior à data final.' },
        { status: 400 },
      )
    }

    const data = await getDashboardData(auth.supabase, {
      startDate,
      endDate,
      vehicleId: params.get('veiculo') || null,
      driverId: params.get('motorista') || null,
    })

    return NextResponse.json({ dashboard: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível carregar o dashboard.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
