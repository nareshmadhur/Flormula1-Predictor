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

const appWorker = openNextWorker as OpenNextWorker

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
    return appWorker.fetch(request, env, ctx)
  },

  async scheduled(
    controller: ScheduledControllerLike,
    env: WorkerEnv,
    ctx: ExecutionContextLike
  ) {
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
