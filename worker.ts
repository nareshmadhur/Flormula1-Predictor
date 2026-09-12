// OpenNext generates this module during `opennextjs-cloudflare build`.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore The generated module is created by OpenNext before Wrangler bundles this worker.
import openNextWorker from './.open-next/worker.js'

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

type ScheduledControllerLike = {
  cron: string
  scheduledTime: number
  noRetry?: () => void
}

type WorkerEnv = {
  CRON_SECRET?: string
  NOTIFICATION_CRON_SECRET?: string
  ENABLE_LIFECYCLE_CRON?: string
  SUPABASE_TRAFFIC_PAUSED?: string
  [key: string]: unknown
}

type OpenNextWorker = {
  fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContextLike
  ): Promise<Response>
}

const notificationJobs: Record<string, string> = {
  '0 6 * * *': '/api/notifications/race-reminders',
  '0 7 * * *': '/api/notifications/score-recaps',
}

const PUBLIC_CACHE_TTL_SECONDS = 30
const publicCacheablePaths = new Set([
  '/',
  '/about',
  '/contact',
  '/forgot-password',
  '/leaderboard',
  '/login',
  '/privacy',
  '/reset-password',
  '/season',
  '/signup',
  '/terms',
  '/robots.txt',
  '/sitemap.xml',
])

const appWorker = openNextWorker as OpenNextWorker

function getCloudflareCache() {
  return (globalThis as typeof globalThis & { caches: CacheStorage & { default: Cache } }).caches.default
}

function isPublicRacePage(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 2 && segments[0] === 'race'
}

function isPublicCacheableRequest(request: Request) {
  if (request.method !== 'GET') return false
  if (request.headers.has('cookie') || request.headers.has('authorization')) return false

  // Next's RSC and prefetch requests are different response variants from a
  // document request. Never store one in the same URL-keyed edge cache entry.
  if (
    request.headers.has('RSC') ||
    request.headers.has('Next-Router-Prefetch') ||
    request.headers.has('Next-Url') ||
    request.headers.get('purpose') === 'prefetch' ||
    (request.headers.get('accept') || '').includes('text/x-component')
  ) {
    return false
  }

  const url = new URL(request.url)
  return publicCacheablePaths.has(url.pathname) || isPublicRacePage(url.pathname)
}

function hasTrustedFormOrigin(request: Request) {
  const origin = request.headers.get('origin')?.trim()
  const requestHost = request.headers.get('host')?.trim().toLowerCase()

  if (!origin || origin === 'null' || !requestHost) return false

  try {
    const originUrl = new URL(origin)
    return (
      (originUrl.protocol === 'https:' || originUrl.protocol === 'http:') &&
      originUrl.host.toLowerCase() === requestHost
    )
  } catch {
    return false
  }
}

function isUntrustedFormPost(request: Request) {
  if (request.method !== 'POST') return false

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) return false

  // Browser Server Actions include a same-origin Origin. Rejecting untrusted
  // multipart posts at the edge keeps forged signup requests away from Next
  // and Supabase.
  return !hasTrustedFormOrigin(request)
}

function invalidFormRequestResponse() {
  return new Response('Invalid form request.', {
    status: 403,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

async function fetchApp(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContextLike
) {
  if (isUntrustedFormPost(request)) {
    return invalidFormRequestResponse()
  }

  if (!isPublicCacheableRequest(request)) {
    return appWorker.fetch(request, env, ctx)
  }

  const cache = getCloudflareCache()
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    const headers = new Headers(cachedResponse.headers)
    headers.set('x-flormula1-cache', 'HIT')
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    })
  }

  const response = await appWorker.fetch(request, env, ctx)
  const contentType = response.headers.get('content-type') || ''

  if (
    response.status === 200 &&
    !response.headers.has('set-cookie') &&
    (contentType.startsWith('text/') || contentType.includes('xml'))
  ) {
    const headers = new Headers(response.headers)
    headers.set(
      'cache-control',
      `public, max-age=${PUBLIC_CACHE_TTL_SECONDS}, s-maxage=${PUBLIC_CACHE_TTL_SECONDS}, stale-while-revalidate=60`
    )
    headers.set('x-flormula1-cache', 'MISS')
    const cacheableResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })

    ctx.waitUntil(cache.put(request, cacheableResponse.clone()))
    return cacheableResponse
  }

  return response
}

async function runNotificationJob(
  path: string,
  env: WorkerEnv,
  ctx: ExecutionContextLike
) {
  const cronSecret = env.CRON_SECRET || env.NOTIFICATION_CRON_SECRET
  if (!cronSecret) {
    throw new Error('Missing CRON_SECRET or NOTIFICATION_CRON_SECRET.')
  }

  const response = await appWorker.fetch(
    new Request(`https://flormula1-predictor.internal${path}`, {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    }),
    env,
    ctx
  )

  if (!response.ok) {
    throw new Error(`Notification job failed with HTTP ${response.status}.`)
  }
}

const worker = {
  fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContextLike
  ) {
    return fetchApp(request, env, ctx)
  },

  async scheduled(
    controller: ScheduledControllerLike,
    env: WorkerEnv,
    ctx: ExecutionContextLike
  ) {
    if (env.ENABLE_LIFECYCLE_CRON !== 'true') {
      controller.noRetry?.()
      return
    }

    const path = notificationJobs[controller.cron]
    if (!path) {
      controller.noRetry?.()
      console.warn(`No notification job configured for cron: ${controller.cron}`)
      return
    }

    await runNotificationJob(path, env, ctx)
  },
}

export default worker
