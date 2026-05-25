import { runScoreRecapEmails } from '@/utils/race-notifications'
import {
  getNotificationRunnerOptions,
  isAuthorizedNotificationRunnerRequest,
} from '@/utils/notification-runner-request'

export const dynamic = 'force-dynamic'

async function handleRequest(request: Request) {
  if (!isAuthorizedNotificationRunnerRequest(request)) {
    return Response.json(
      { error: 'Unauthorized notification runner request.' },
      { status: 401 }
    )
  }

  try {
    const runnerOptions = getNotificationRunnerOptions(request)
    if (runnerOptions.error) return runnerOptions.error

    const result = await runScoreRecapEmails(new Date(), runnerOptions.options)
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
