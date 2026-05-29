import { getAbsoluteUrl } from '@/utils/site'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

type ParsedSender = {
  email: string
  name?: string
}

export type TransactionalEmailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'missing-email' | 'not-configured' }

type TransactionalEmailInput = {
  to: {
    email: string | null | undefined
    name?: string | null
  }
  subject: string
  htmlContent: string
}

type BrandedEmailAction = {
  label: string
  url: string
  tone?: 'primary' | 'secondary'
}

type BrandedEmailInput = {
  eyebrow: string
  title: string
  intro: string
  bodyHtml?: string
  actions?: BrandedEmailAction[]
  unsubscribeUrl?: string | null
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
    parseSender(process.env.LIFECYCLE_EMAIL_FROM) ||
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

export function isTransactionalEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY?.trim() && getSender())
}

function getRecipientName(value: string | null | undefined) {
  const name = value?.trim()
  return name || undefined
}

export function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderAction({ label, url, tone = 'primary' }: BrandedEmailAction) {
  const primaryStyle = 'background:#dc2626;color:#ffffff;border:1px solid #dc2626;'
  const secondaryStyle = 'background:#111827;color:#f8fafc;border:1px solid rgba(148,163,184,0.24);'

  return `
    <a href="${escapeHtml(url)}" style="display:inline-block;border-radius:14px;${tone === 'primary' ? primaryStyle : secondaryStyle}font-size:15px;font-weight:800;text-decoration:none;padding:14px 20px;margin:0 8px 10px 0;">
      ${escapeHtml(label)}
    </a>
  `.trim()
}

export function renderBrandedEmail({
  eyebrow,
  title,
  intro,
  bodyHtml = '',
  actions = [],
  unsubscribeUrl,
}: BrandedEmailInput) {
  const profileUrl = getAbsoluteUrl('/me/profile')
  const unsubscribeCopy = unsubscribeUrl
    ? `
      <p style="margin:14px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
        You are receiving this because you asked for FLORMULA1 race emails.
        <a href="${escapeHtml(profileUrl)}" style="color:#cbd5e1;text-decoration:underline;">Manage preferences</a>
        or
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#cbd5e1;text-decoration:underline;">change email choices</a>.
      </p>
    `
    : ''

  return `
    <div style="margin:0;padding:32px 16px;background:#020617;font-family:Inter,Segoe UI,Arial,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
        ${escapeHtml(intro)}
      </div>
      <div style="max-width:580px;margin:0 auto;border:1px solid rgba(148,163,184,0.18);border-radius:28px;overflow:hidden;background:#0f172a;">
        <div style="padding:28px 28px 20px;background:linear-gradient(135deg, rgba(220,38,38,0.24), rgba(15,23,42,0.96));border-bottom:1px solid rgba(148,163,184,0.12);">
          <div style="display:inline-block;border:1px solid rgba(248,113,113,0.28);border-radius:999px;padding:8px 12px;color:#fecaca;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">
            ${escapeHtml(eyebrow)}
          </div>
          <h1 style="margin:18px 0 0;color:#ffffff;font-size:30px;line-height:1.1;font-style:italic;font-weight:900;">
            ${escapeHtml(title)}
          </h1>
          <div style="margin:18px 0 0;">
            <span style="font-size:22px;font-weight:900;font-style:italic;letter-spacing:-0.08em;">
              <span style="color:#ef4444;">FLO</span><span style="color:#f8fafc;">RMULA1</span>
            </span>
          </div>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;color:#cbd5e1;font-size:16px;line-height:1.6;">
            ${escapeHtml(intro)}
          </p>
          ${bodyHtml}
          ${
            actions.length > 0
              ? `<div style="margin:24px 0 4px;">${actions.map(renderAction).join('')}</div>`
              : ''
          }
          <div style="margin-top:24px;border-top:1px solid rgba(148,163,184,0.12);padding-top:18px;">
            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
              FLORMULA1 is a free fan scoreboard for private groups. No betting, wagers, or cash prizes.
            </p>
            ${unsubscribeCopy}
          </div>
        </div>
      </div>
    </div>
  `.trim()
}

export async function sendTransactionalEmail({
  to,
  subject,
  htmlContent,
}: TransactionalEmailInput): Promise<TransactionalEmailResult> {
  const email = to.email?.trim()

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
          name: getRecipientName(to.name),
        },
      ],
      subject,
      htmlContent,
    }),
    signal: AbortSignal.timeout(4000),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Transactional email failed: ${response.status} ${errorText}`)
  }

  return { status: 'sent' }
}
