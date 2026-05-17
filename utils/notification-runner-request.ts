import type { RaceNotificationRunOptions } from '@/utils/race-notifications'

function isTruthy(value: string | null | undefined) {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function getBoundedNumber(value: string | null | undefined, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function getNotificationRunnerOptions(request: Request) {
  const url = new URL(request.url)
  const dryRun =
    isTruthy(url.searchParams.get('dryRun')) ||
    isTruthy(url.searchParams.get('dry_run')) ||
    isTruthy(request.headers.get('x-notification-dry-run'))
  const testUsersOnly =
    isTruthy(url.searchParams.get('testUsersOnly')) ||
    isTruthy(url.searchParams.get('test_users_only')) ||
    isTruthy(request.headers.get('x-notification-test-users-only'))
  const wantsTest =
    !dryRun &&
    (isTruthy(url.searchParams.get('test')) ||
      Boolean(request.headers.get('x-notification-test-recipient')) ||
      testUsersOnly)
  const testRecipient = wantsTest
    ? (
        request.headers.get('x-notification-test-recipient') ||
        url.searchParams.get('testRecipient') ||
        url.searchParams.get('test_recipient') ||
        ''
      ).trim()
    : null

  if (wantsTest && !testRecipient && !testUsersOnly) {
    return {
      error: Response.json(
        {
          ok: false,
          error: 'Test mode requires x-notification-test-recipient, testRecipient, or testUsersOnly=1.',
        },
        { status: 400 }
      ),
    }
  }

  if (testRecipient && !isEmailLike(testRecipient)) {
    return {
      error: Response.json(
        {
          ok: false,
          error: 'Test recipient must be an email address.',
        },
        { status: 400 }
      ),
    }
  }

  const options: RaceNotificationRunOptions = {
    dryRun,
    testRecipient,
    testUsersOnly,
    testRunId:
      url.searchParams.get('testRunId') ||
      url.searchParams.get('test_run_id') ||
      request.headers.get('x-notification-test-run-id') ||
      undefined,
    testLimit: getBoundedNumber(
      url.searchParams.get('testLimit') ||
        url.searchParams.get('limit') ||
        request.headers.get('x-notification-test-limit'),
      5,
      50
    ),
    previewLimit: getBoundedNumber(
      url.searchParams.get('previewLimit') ||
        url.searchParams.get('preview_limit') ||
        request.headers.get('x-notification-preview-limit'),
      20,
      100
    ),
  }

  return { options }
}
