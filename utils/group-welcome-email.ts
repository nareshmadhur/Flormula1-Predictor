import { getAbsoluteUrl } from '@/utils/site'
import { renderBrandedEmail, sendTransactionalEmail } from '@/utils/email'

type GroupWelcomeEmailInput = {
  email: string | null | undefined
  displayName?: string | null
  groupName: string
  joinedVia: 'invite' | 'admin-assigned' | 'admin-moved'
}

type SendEmailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'missing-email' | 'not-configured' }

function getDisplayName(value: string | null | undefined) {
  const name = value?.trim()
  return name ? name : 'there'
}

function getWelcomeSubject(groupName: string) {
  return `Welcome to ${groupName} on Flormula1`
}

function getWelcomeIntro(joinedVia: GroupWelcomeEmailInput['joinedVia'], groupName: string) {
  if (joinedVia === 'invite') {
    return `You just joined ${groupName}.`
  }

  if (joinedVia === 'admin-moved') {
    return `Your Flormula1 group has been updated to ${groupName}.`
  }

  return `Your Flormula1 account has been added to ${groupName}.`
}

function getWelcomeHtml({
  displayName,
  groupName,
  joinedVia,
}: Omit<GroupWelcomeEmailInput, 'email'>) {
  const standingsUrl = getAbsoluteUrl('/leaderboard?view=tenant')
  const picksUrl = getAbsoluteUrl('/predictions')

  return renderBrandedEmail({
    eyebrow: 'Group update',
    title: `Welcome to ${groupName}`,
    intro: `Hi ${getDisplayName(displayName)}, ${getWelcomeIntro(joinedVia, groupName)} Your standings and race picks are ready.`,
    actions: [
      { label: 'Open my race page', url: picksUrl },
      { label: 'Open group standings', url: standingsUrl, tone: 'secondary' },
    ],
  })
}

export async function sendGroupWelcomeEmail(
  input: GroupWelcomeEmailInput
): Promise<SendEmailResult> {
  const email = input.email?.trim()

  if (!email) {
    return { status: 'skipped', reason: 'missing-email' }
  }

  return sendTransactionalEmail({
    to: {
      email,
      name: input.displayName,
    },
    subject: getWelcomeSubject(input.groupName),
    htmlContent: getWelcomeHtml(input),
  })
}
