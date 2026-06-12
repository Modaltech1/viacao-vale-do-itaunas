import { NextRequest, NextResponse } from 'next/server'
import { getAdminManagementData } from '@/lib/admin-management-repository'
import {
  adminManagementErrorResponse,
  createAdminUser,
  parseAdminPayload,
} from '@/lib/admin-management-service'
import {
  createSupabaseServiceClient,
  requireGlobalAdmin,
} from '@/lib/supabase-server'

export async function GET() {
  const auth = await requireGlobalAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const service = createSupabaseServiceClient()
    return NextResponse.json(
      await getAdminManagementData(service, auth.user.id),
    )
  } catch (error) {
    return adminManagementErrorResponse(
      error,
      'Não foi possível carregar os administradores.',
      500,
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireGlobalAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const payload = parseAdminPayload(await request.json())
    const service = createSupabaseServiceClient()
    const id = await createAdminUser(service, auth.user.id, payload)
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error) {
    return adminManagementErrorResponse(
      error,
      'Não foi possível criar o administrador.',
    )
  }
}
