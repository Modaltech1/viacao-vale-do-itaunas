import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

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
    .select('papel, ativo')
    .eq('id', user.id)
    .single<{ papel: string; ativo: boolean }>()

  if (!profile || !profile.ativo || profile.papel !== 'admin') {
    return { ok: false as const, status: 403, error: 'Acesso permitido apenas para administradores.' }
  }

  return { ok: true as const, user, supabase }
}
