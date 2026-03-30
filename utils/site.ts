const LOCAL_SITE_URL = 'http://localhost:3000'

function normalizeSiteUrl(value: string) {
  const trimmedValue = value.trim()
  const withProtocol =
    trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')
      ? trimmedValue
      : `https://${trimmedValue}`

  return withProtocol.endsWith('/') ? withProtocol.slice(0, -1) : withProtocol
}

export function getSiteUrl() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    LOCAL_SITE_URL

  return normalizeSiteUrl(siteUrl)
}

export function getAbsoluteUrl(path = '/') {
  const pathname = path.startsWith('/') ? path : `/${path}`
  return new URL(pathname, getSiteUrl()).toString()
}
