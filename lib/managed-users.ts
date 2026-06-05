import 'server-only'

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/auth'

type ManagedUserInput = {
  name: string
  email: string
  password?: string
  phone: string
  active: boolean
  role: Exclude<UserRole, 'admin'>
}

export function managedUserErrorResponse(error: unknown, entity: string, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid api key')) {
    return NextResponse.json(
      { error: 'A configuração server-side do Supabase está inválida.' },
      { status: 500 },
    )
  }

  if (
    normalized.includes('duplicate')
    || normalized.includes('already registered')
    || normalized.includes('already exists')
  ) {
    return NextResponse.json(
      { error: `Já existe um usuário ou ${entity} com esses dados.` },
      { status: 409 },
    )
  }

  return NextResponse.json({ error: message || fallback }, { status })
}

export async function createManagedUser(
  service: SupabaseClient,
  adminId: string,
  input: ManagedUserInput & { password: string },
) {
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { papel: input.role },
    user_metadata: { nome: input.name },
  })

  if (createError || !created.user) {
    throw createError ?? new Error('Não foi possível criar o usuário no Supabase Auth.')
  }

  const userId = created.user.id
  const { error: profileError } = await service
    .from('perfis')
    .update({
      nome: input.name,
      email: input.email,
      telefone: input.phone || null,
      papel: input.role,
      ativo: input.active,
      criado_por: adminId,
      atualizado_por: adminId,
    })
    .eq('id', userId)

  if (profileError) {
    await service.auth.admin.deleteUser(userId)
    throw profileError
  }

  return userId
}

export async function updateManagedUser(
  service: SupabaseClient,
  adminId: string,
  userId: string,
  input: ManagedUserInput,
) {
  const authPayload: {
    email: string
    password?: string
    app_metadata: { papel: string }
    user_metadata: { nome: string }
  } = {
    email: input.email,
    app_metadata: { papel: input.role },
    user_metadata: { nome: input.name },
  }

  if (input.password) authPayload.password = input.password

  const { error: authError } = await service.auth.admin.updateUserById(userId, authPayload)
  if (authError) throw authError

  const { error: profileError } = await service
    .from('perfis')
    .update({
      nome: input.name,
      email: input.email,
      telefone: input.phone || null,
      papel: input.role,
      ativo: input.active,
      atualizado_por: adminId,
    })
    .eq('id', userId)

  if (profileError) throw profileError
}

export async function deleteManagedUser(service: SupabaseClient, userId: string | null) {
  if (userId) await service.auth.admin.deleteUser(userId)
}
