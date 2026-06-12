import { NextRequest, NextResponse } from 'next/server'
import {
  adminManagementErrorResponse,
  parseAdminPayload,
  updateAdminUser,
} from '@/lib/admin-management-service'
import {
  createSupabaseServiceClient,
  requireGlobalAdmin,
} from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireGlobalAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await context.params
    const payload = parseAdminPayload(await request.json(), true)
    const service = createSupabaseServiceClient()
    await updateAdminUser(service, auth.user.id, id, payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return adminManagementErrorResponse(
      error,
      'Não foi possível atualizar o administrador.',
    )
  }
}
