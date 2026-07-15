import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/error-response'
import { getReportData } from '@/lib/reports-repository'
import { requireAdmin } from '@/lib/supabase-server'

function requiredDate(value: string | null, label: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} inválida.`)
  }
  return value
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const params = request.nextUrl.searchParams
    const startDate = requiredDate(params.get('inicio'), 'Data inicial')
    const endDate = requiredDate(params.get('fim'), 'Data final')
    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'A data inicial não pode ser posterior à data final.' },
        { status: 400 },
      )
    }

    const maintenanceType = params.get('tipoManutencao')
    const report = await getReportData(auth.supabase, auth.admin, {
      startDate,
      endDate,
      vehicleId: params.get('veiculo') || null,
      driverId: params.get('motorista') || null,
      serviceId: params.get('servico') || null,
      maintenanceType:
        maintenanceType === 'preventiva' || maintenanceType === 'corretiva'
          ? maintenanceType
          : null,
    })

    return NextResponse.json({ report })
  } catch (error) {
    return apiErrorResponse(error, 'Não foi possível gerar o relatório.', 500)
  }
}
