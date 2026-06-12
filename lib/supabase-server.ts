import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { createAdminAccess } from '@/lib/admin-scope'

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error('As variáveis públicas do Supabase não foram configuradas.')
  }

  return { url, publishableKey }
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const { url, publishableKey } = getSupabaseConfig()

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

export function createSupabaseServiceClient() {
  const { url } = getSupabaseConfig()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('A variável SUPABASE_SERVICE_ROLE_KEY não foi configurada.')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, status: 401, error: 'Sessão não encontrada.' }
  }

  const { data: profile } = await supabase
    .from('perfis')
    .select('papel, ativo, nivel_admin')
    .eq('id', user.id)
    .single<{ papel: string; ativo: boolean; nivel_admin: string | null }>()

  if (!profile || !profile.ativo || profile.papel !== 'admin') {
    return { ok: false as const, status: 403, error: 'Acesso permitido apenas para administradores.' }
  }

  return {
    ok: true as const,
    user,
    supabase,
    admin: createAdminAccess(user.id, profile.nivel_admin),
  }
}

export async function requireGlobalAdmin() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  if (!auth.admin.isGlobal) {
    return {
      ok: false as const,
      status: 403,
      error: 'Acesso permitido apenas para administradores globais.',
    }
  }

  return auth
}

export async function requireDriver() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, status: 401, error: 'Sessão não encontrada.' }
  }

  const { data: profile } = await supabase
    .from('perfis')
    .select('papel,ativo')
    .eq('id', user.id)
    .single<{ papel: string; ativo: boolean }>()

  if (!profile || !profile.ativo || profile.papel !== 'motorista') {
    return { ok: false as const, status: 403, error: 'Acesso permitido apenas para motoristas.' }
  }

  const { data: driver } = await supabase
    .from('motoristas')
    .select('id,status_profissional')
    .eq('perfil_id', user.id)
    .is('excluido_em', null)
    .single<{ id: string; status_profissional: string }>()

  if (!driver || driver.status_profissional !== 'ativo') {
    return {
      ok: false as const,
      status: 403,
      error: 'O cadastro profissional do motorista não está ativo.',
    }
  }

  return { ok: true as const, user, driver, supabase }
}

export async function requireMechanic() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, status: 401, error: 'Sessão não encontrada.' }
  }

  const { data: profile } = await supabase
    .from('perfis')
    .select('papel,ativo')
    .eq('id', user.id)
    .single<{ papel: string; ativo: boolean }>()

  if (!profile || !profile.ativo || profile.papel !== 'mecanico') {
    return { ok: false as const, status: 403, error: 'Acesso permitido apenas para mecânicos.' }
  }

  const { data: mechanic } = await supabase
    .from('mecanicos')
    .select('id,status_profissional')
    .eq('perfil_id', user.id)
    .is('excluido_em', null)
    .single<{ id: string; status_profissional: string }>()

  if (!mechanic || mechanic.status_profissional !== 'ativo') {
    return {
      ok: false as const,
      status: 403,
      error: 'O cadastro profissional do mecânico não está ativo.',
    }
  }

  return { ok: true as const, user, mechanic, supabase }
}
