import { NextRequest, NextResponse } from 'next/server'
import {
  adminManagementErrorResponse,
  transferAdminResource,
} from '@/lib/admin-management-service'
import {
  createSupabaseServiceClient,
  requireGlobalAdmin,
} from '@/lib/supabase-server'
import type { AdminResourceType } from '@/types/admin-management'

export async function PATCH(request: NextRequest) {
  const auth = await requireGlobalAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const resourceType = String(body.resourceType ?? '') as AdminResourceType
    const resourceId = String(body.resourceId ?? '').trim()
    const targetAdminId = String(body.adminId ?? '').trim() || null
    const service = createSupabaseServiceClient()

    await transferAdminResource(
      service,
      auth.user.id,
      resourceType,
      resourceId,
      targetAdminId,
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return adminManagementErrorResponse(
      error,
      'Não foi possível transferir a responsabilidade.',
    )
  }
}
