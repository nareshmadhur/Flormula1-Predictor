import { headers } from 'next/headers'
import { getSiteUrl } from '@/utils/site'

export async function getRequestOrigin() {
  const headersList = await headers()
  const origin = headersList.get('origin')

  if (origin && origin !== 'null') {
    try {
      return new URL(origin).origin
    } catch {
      // Fall through to forwarded headers or configured site URL.
    }
  }

  const forwardedHost = headersList.get('x-forwarded-host') || headersList.get('host')

  if (forwardedHost) {
    const forwardedProto = headersList.get('x-forwarded-proto') || 'https'

    try {
      return new URL(`${forwardedProto}://${forwardedHost}`).origin
    } catch {
      // Fall through to configured site URL.
    }
  }

  return getSiteUrl()
}

export function getSafeNextPath(value: FormDataEntryValue | string | null | undefined, fallback = '/predictions') {
  const raw = String(value ?? '').trim()

  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback
  }

  return raw
}

export function withNextQuery(path: string, nextPath: string | null | undefined) {
  const safeNext = getSafeNextPath(nextPath, '')
  if (!safeNext) return path

  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}next=${encodeURIComponent(safeNext)}`
}

export function getAuthCallbackUrl(nextPath: string | null | undefined) {
  const url = new URL('/auth/callback', getSiteUrl())
  url.searchParams.set('next', getSafeNextPath(nextPath))
  return url.toString()
}
