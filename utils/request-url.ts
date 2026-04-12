import { headers } from 'next/headers'

export async function getRequestOrigin() {
  const headersList = await headers()
  return headersList.get('origin') || 'http://localhost:3000'
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
