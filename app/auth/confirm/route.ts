import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { getSafeNextPath } from '@/utils/request-url'

const supportedEmailOtpTypes = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function getConfirmationNextPath(requestUrl: URL, type: EmailOtpType) {
  const fallback = type === 'recovery' ? '/reset-password' : '/predictions'
  const next = getSafeNextPath(requestUrl.searchParams.get('next'), '')

  if (next) return next

  const redirectTo = requestUrl.searchParams.get('redirect_to')

  if (redirectTo) {
    try {
      const redirectUrl = new URL(redirectTo)
      const redirectNext = getSafeNextPath(redirectUrl.searchParams.get('next'), '')

      if (redirectNext) return redirectNext
    } catch {
      // Ignore malformed redirect_to values and use the safe fallback.
    }
  }

  return fallback
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null

  if (!tokenHash || !type || !supportedEmailOtpTypes.has(type)) {
    const errorUrl = new URL('/login', requestUrl.origin)
    errorUrl.searchParams.set('error', 'That email link is incomplete. Try the latest email we sent you.')
    return NextResponse.redirect(errorUrl)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })

  if (error) {
    const errorUrl = new URL(type === 'recovery' ? '/forgot-password' : '/login', requestUrl.origin)
    errorUrl.searchParams.set('error', 'That email link could not be verified. Try the latest email we sent you.')
    return NextResponse.redirect(errorUrl)
  }

  return NextResponse.redirect(new URL(getConfirmationNextPath(requestUrl, type), requestUrl.origin))
}
