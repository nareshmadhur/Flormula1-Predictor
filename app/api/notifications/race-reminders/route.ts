import { runPreLockReminderEmails } from '@/utils/race-notifications'
import { getNotificationRunnerOptions } from '@/utils/notification-runner-request'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
  const expectedSecret = process.env.NOTIFICATION_CRON_SECRET || process.env.CRON_SECRET
  if (!expectedSecret) return false

  const authorization = request.headers.get('authorization')
  const cronSecret = request.headers.get('x-cron-secret')

  return authorization === `Bearer ${expectedSecret}` || cronSecret === expectedSecret
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { error: 'Unauthorized notification runner request.' },
      { status: 401 }
    )
  }

  try {
    const runnerOptions = getNotificationRunnerOptions(request)
    if (runnerOptions.error) return runnerOptions.error

    const result = await runPreLockReminderEmails(new Date(), runnerOptions.options)
    return Response.json(result, { status: result.ok ? 200 : 207 })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Notification runner failed.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}
