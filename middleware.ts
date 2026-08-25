import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessPath, getRoleHome, isUserRole, type AuthProfile } from '@/lib/auth'

const loginPath = '/login'
const publicPaths = ['/politica-de-privacidade']

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function isLoginPath(pathname: string) {
  return pathname === loginPath || pathname.startsWith(`${loginPath}/`)
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: AuthProfile | null = null

  if (user) {
    const { data } = await supabase
      .from('perfis')
      .select('papel, ativo')
      .eq('id', user.id)
      .single<AuthProfile>()

    profile = data
  }

  function redirect(pathname: string) {
    const redirectResponse = NextResponse.redirect(new URL(pathname, request.url))

    response.cookies.getAll().forEach(({ name, value }) => {
      redirectResponse.cookies.set(name, value)
    })

    return redirectResponse
  }

  if (!user || !profile || !profile.ativo || !isUserRole(profile.papel)) {
    if (isLoginPath(request.nextUrl.pathname) || isPublicPath(request.nextUrl.pathname)) {
      return response
    }
    return redirect(loginPath)
  }

  const home = getRoleHome(profile.papel)

  if (request.nextUrl.pathname === '/' || isLoginPath(request.nextUrl.pathname)) {
    return redirect(home)
  }

  if (isPublicPath(request.nextUrl.pathname)) return response

  if (!canAccessPath(profile.papel, request.nextUrl.pathname)) {
    return redirect(home)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
