import { getAbsoluteUrl } from '@/utils/site'

type GroupWelcomeEmailInput = {
  email: string | null | undefined
  displayName?: string | null
  groupName: string
  joinedVia: 'invite' | 'admin-assigned' | 'admin-moved'
}

type SendEmailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'missing-email' | 'not-configured' }

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

type ParsedSender = {
  email: string
  name?: string
}

function parseSender(value: string | null | undefined): ParsedSender | null {
  const raw = value?.trim()
  if (!raw) return null

  const match = raw.match(/^(.*?)<([^>]+)>$/)
  if (match) {
    const name = match[1]?.trim().replace(/^"|"$/g, '')
    const email = match[2]?.trim()

    if (!email) return null
    return name ? { name, email } : { email }
  }

  return { email: raw }
}

function getSender() {
  const combinedSender =
    parseSender(process.env.GROUP_WELCOME_EMAIL_FROM) ||
    parseSender(process.env.BREVO_SENDER) ||
    parseSender(process.env.BREVO_FROM)

  if (combinedSender) return combinedSender

  const email =
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.BREVO_FROM_EMAIL?.trim() ||
    ''
  const name =
    process.env.BREVO_SENDER_NAME?.trim() ||
    process.env.BREVO_FROM_NAME?.trim() ||
    ''

  if (!email) return null
  return name ? { email, name } : { email }
}

function getDisplayName(value: string | null | undefined) {
  const name = value?.trim()
  return name ? name : 'there'
}

function getRecipientName(value: string | null | undefined) {
  const name = value?.trim()
  return name || undefined
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

  return `
    <div style="margin:0;padding:32px 16px;background:#020617;font-family:Inter,Segoe UI,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(148,163,184,0.18);border-radius:28px;overflow:hidden;background:#0f172a;">
        <div style="padding:28px 28px 20px;background:linear-gradient(135deg, rgba(220,38,38,0.22), rgba(15,23,42,0.92));border-bottom:1px solid rgba(148,163,184,0.12);">
          <div style="display:inline-block;border:1px solid rgba(248,113,113,0.25);border-radius:999px;padding:8px 12px;color:#fecaca;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
            Group update
          </div>
          <h1 style="margin:18px 0 0;color:#ffffff;font-size:30px;line-height:1.1;font-style:italic;">Welcome to ${groupName}</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;line-height:1.6;">Hi ${getDisplayName(displayName)},</p>
          <p style="margin:0 0 18px;color:#cbd5e1;font-size:16px;line-height:1.6;">${getWelcomeIntro(joinedVia, groupName)} You can now follow the private standings and make your race picks from the same account.</p>
          <div style="margin:24px 0;display:flex;flex-wrap:wrap;gap:12px;">
            <a href="${standingsUrl}" style="display:inline-block;border-radius:14px;background:#dc2626;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 20px;">Open group standings</a>
            <a href="${picksUrl}" style="display:inline-block;border-radius:14px;border:1px solid rgba(148,163,184,0.2);background:#111827;color:#f8fafc;font-size:15px;font-weight:700;text-decoration:none;padding:14px 20px;">Open my race page</a>
          </div>
          <div style="border:1px solid rgba(148,163,184,0.12);border-radius:18px;background:#111827;padding:16px 18px;">
            <div style="margin:0 0 8px;color:#ffffff;font-size:14px;font-weight:700;">What changes now</div>
            <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:14px;line-height:1.6;">
              <li>Your group leaderboard view is now active.</li>
              <li>Your future picks will count inside ${groupName}.</li>
              <li>You can still use the same login and profile.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `.trim()
}

export async function sendGroupWelcomeEmail(
  input: GroupWelcomeEmailInput
): Promise<SendEmailResult> {
  const email = input.email?.trim()

  if (!email) {
    return { status: 'skipped', reason: 'missing-email' }
  }

  const apiKey = process.env.BREVO_API_KEY?.trim()
  const sender = getSender()

  if (!apiKey || !sender) {
    return { status: 'skipped', reason: 'not-configured' }
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'flormula1-app/1.0',
    },
    body: JSON.stringify({
      sender,
      to: [
        {
          email,
          name: getRecipientName(input.displayName),
        },
      ],
      subject: getWelcomeSubject(input.groupName),
      htmlContent: getWelcomeHtml(input),
    }),
    signal: AbortSignal.timeout(4000),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Welcome email failed: ${response.status} ${errorText}`)
  }

  return { status: 'sent' }
}
