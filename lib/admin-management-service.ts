import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { adminLevels, type AdminLevel } from '@/lib/admin-scope'
import {
  createManagedUser,
  managedUserErrorResponse,
  updateManagedUser,
} from '@/lib/managed-users'
import type { AdminResourceType } from '@/types/admin-management'

type AdminPayload = {
  name: string
  email: string
  password: string
  phone: string
  active: boolean
  level: AdminLevel
}

function badRequest(message: string) {
  const error = new Error(message)
  Object.assign(error, { status: 400 })
  return error
}

export function parseAdminPayload(
  body: Record<string, unknown>,
  editing = false,
): AdminPayload {
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const phone = String(body.phone ?? '').trim()
  const active = body.active !== false
  const level = String(body.level ?? 'restrito') as AdminLevel

  if (!name || !email || (!editing && !password)) {
    throw badRequest('Nome, email e senha são obrigatórios.')
  }
  if (password && password.length < 6) {
    throw badRequest('A senha deve ter pelo menos 6 caracteres.')
  }
  if (!adminLevels.includes(level)) {
    throw badRequest('Nível administrativo inválido.')
  }

  return { name, email, password, phone, active, level }
}

export async function createAdminUser(
  service: SupabaseClient,
  actorId: string,
  payload: AdminPayload,
) {
  return createManagedUser(service, actorId, {
    ...payload,
    role: 'admin',
    adminLevel: payload.level,
  })
}

export async function updateAdminUser(
  service: SupabaseClient,
  actorId: string,
  adminId: string,
  payload: AdminPayload,
) {
  if (actorId === adminId && (!payload.active || payload.level !== 'global')) {
    throw badRequest('Você não pode desativar ou restringir o próprio acesso global.')
  }

  const { data: current, error: currentError } = await service
    .from('perfis')
    .select('nivel_admin,ativo')
    .eq('id', adminId)
    .eq('papel', 'admin')
    .single<{ nivel_admin: AdminLevel; ativo: boolean }>()

  if (currentError || !current) {
    const error = new Error('Administrador não encontrado.')
    Object.assign(error, { status: 404 })
    throw error
  }

  if (current.nivel_admin === 'global' && current.ativo && (
    payload.level !== 'global' || !payload.active
  )) {
    const { count, error: countError } = await service
      .from('perfis')
      .select('id', { count: 'exact', head: true })
      .eq('papel', 'admin')
      .eq('nivel_admin', 'global')
      .eq('ativo', true)

    if (countError) throw countError
    if ((count ?? 0) <= 1) {
      throw badRequest('O sistema precisa manter pelo menos um administrador global ativo.')
    }
  }

  await updateManagedUser(service, actorId, adminId, {
    ...payload,
    role: 'admin',
    adminLevel: payload.level,
  })
}

export async function transferAdminResource(
  client: SupabaseClient,
  resourceType: AdminResourceType,
  resourceId: string,
  targetAdminId: string | null,
) {
  if (!resourceId) throw badRequest('Recurso inválido.')
  if (!['vehicle', 'driver', 'part'].includes(resourceType)) {
    throw badRequest('Tipo de recurso inválido.')
  }

  const { data, error } = await client.rpc(
    'fn_transferir_responsabilidade_admin',
    {
      p_tipo: resourceType,
      p_recurso_id: resourceId,
      p_admin_responsavel_id: targetAdminId,
    },
  )

  if (error) throw error
  return data as { vehicles: number; drivers: number; parts?: number } | null
}

export function adminManagementErrorResponse(
  error: unknown,
  fallback: string,
  status = 400,
) {
  return managedUserErrorResponse(error, 'administrador', fallback, status)
}
