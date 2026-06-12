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

async function requireActiveAdmin(service: SupabaseClient, adminId: string | null) {
  if (!adminId) return

  const { data, error } = await service
    .from('perfis')
    .select('id')
    .eq('id', adminId)
    .eq('papel', 'admin')
    .eq('ativo', true)
    .maybeSingle()

  if (error) throw error
  if (!data) throw badRequest('O administrador responsável precisa estar ativo.')
}

export async function transferAdminResource(
  service: SupabaseClient,
  actorId: string,
  resourceType: AdminResourceType,
  resourceId: string,
  targetAdminId: string | null,
) {
  if (!resourceId) throw badRequest('Recurso inválido.')
  if (!['vehicle', 'driver'].includes(resourceType)) {
    throw badRequest('Tipo de recurso inválido.')
  }

  await requireActiveAdmin(service, targetAdminId)

  if (resourceType === 'vehicle') {
    const { data: links, error: linksError } = await service
      .from('veiculo_motoristas')
      .select('motorista_id,motoristas(admin_responsavel_id)')
      .eq('veiculo_id', resourceId)
      .eq('ativo', true)
      .is('fim_em', null)

    if (linksError) throw linksError

    const driverIdsToAdopt: string[] = []
    for (const link of links ?? []) {
      const driver = Array.isArray(link.motoristas) ? link.motoristas[0] : link.motoristas
      const ownerId = driver?.admin_responsavel_id ?? null
      if (ownerId && ownerId !== targetAdminId) {
        throw badRequest(
          'Transfira primeiro os motoristas ativos vinculados ou escolha o mesmo responsável.',
        )
      }
      if (!ownerId && targetAdminId) driverIdsToAdopt.push(String(link.motorista_id))
    }

    if (driverIdsToAdopt.length) {
      const { error } = await service
        .from('motoristas')
        .update({ admin_responsavel_id: targetAdminId, atualizado_por: actorId })
        .in('id', driverIdsToAdopt)
      if (error) throw error
    }

    const { data, error } = await service
      .from('veiculos')
      .update({ admin_responsavel_id: targetAdminId, atualizado_por: actorId })
      .eq('id', resourceId)
      .is('excluido_em', null)
      .select('id')
      .single()

    if (error || !data) throw error ?? new Error('Veículo não encontrado.')
    return
  }

  const { data: links, error: linksError } = await service
    .from('veiculo_motoristas')
    .select('veiculo_id,veiculos(admin_responsavel_id)')
    .eq('motorista_id', resourceId)
    .eq('ativo', true)
    .is('fim_em', null)

  if (linksError) throw linksError

  for (const link of links ?? []) {
    const vehicle = Array.isArray(link.veiculos) ? link.veiculos[0] : link.veiculos
    const ownerId = vehicle?.admin_responsavel_id ?? null
    if (!ownerId && targetAdminId) {
      throw badRequest(
        'Atribua primeiro o veículo vinculado; ele incluirá os motoristas ainda sem responsável.',
      )
    }
    if (ownerId && ownerId !== targetAdminId) {
      throw badRequest(
        'Transfira primeiro os veículos ativos vinculados ou escolha o mesmo responsável.',
      )
    }
  }

  const { data, error } = await service
    .from('motoristas')
    .update({ admin_responsavel_id: targetAdminId, atualizado_por: actorId })
    .eq('id', resourceId)
    .is('excluido_em', null)
    .select('id')
    .single()

  if (error || !data) throw error ?? new Error('Motorista não encontrado.')
}

export function adminManagementErrorResponse(
  error: unknown,
  fallback: string,
  status = 400,
) {
  return managedUserErrorResponse(error, 'administrador', fallback, status)
}
