import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasSupabaseAuthCookie } from '@/utils/supabase/auth-cookie'
import { fetchWithTimeout } from '@/utils/supabase/fetch'

const sessionRefreshPrefixes = ['/admin', '/api/admin', '/groups', '/me', '/predictions', '/race']

function shouldRefreshSession(pathname: string) {
  return sessionRefreshPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Anonymous public requests do not need a round trip to Supabase Auth.
  // This keeps the public shell available while the database or Auth service
  // is recovering and avoids spending a request on every asset navigation.
  if (
    !hasSupabaseAuthCookie(request.cookies.getAll()) ||
    !shouldRefreshSession(request.nextUrl.pathname)
  ) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchWithTimeout,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    (
      request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/predictions') ||
      request.nextUrl.pathname.startsWith('/race') 
    )
  ) {
    // Note: in a real app you'd probably only redirect specific protected paths.
    // For now we'll rely on the specific protected routes handling redirecting themselves.
  }

  return supabaseResponse
}
