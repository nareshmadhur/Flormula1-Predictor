import { renderBrandedEmail } from '@/utils/email'
import { getAbsoluteUrl } from '@/utils/site'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

type RouteContext = {
  params: Promise<{ token: string }>
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

async function handleRequest(_request: Request, context: RouteContext) {
  const { token } = await context.params
  const cleanToken = String(token || '').trim()

  if (!cleanToken || cleanToken.length < 20) {
    return htmlResponse(
      renderBrandedEmail({
        eyebrow: 'Email preferences',
        title: 'This unsubscribe link is incomplete',
        intro: 'We could not find enough information in this link to update your FLORMULA1 email preferences.',
        actions: [{ label: 'Open FLORMULA1', url: getAbsoluteUrl('/') }],
      }),
      400
    )
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('notification_preferences')
    .update({
      race_reminder_emails_enabled: false,
      score_recap_emails_enabled: false,
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('unsubscribe_token', cleanToken)
    .select('user_id')
    .maybeSingle()

  if (error || !data) {
    return htmlResponse(
      renderBrandedEmail({
        eyebrow: 'Email preferences',
        title: 'This unsubscribe link is no longer active',
        intro: 'Your preferences may already have changed, or this link may be from an older email.',
        actions: [{ label: 'Manage notifications', url: getAbsoluteUrl('/me/profile') }],
      }),
      404
    )
  }

  return htmlResponse(
    renderBrandedEmail({
      eyebrow: 'Email preferences',
      title: 'You are unsubscribed',
      intro: 'Race reminder and score recap emails are now turned off for this FLORMULA1 account.',
      actions: [
        { label: 'Open Profile & Notifications', url: getAbsoluteUrl('/me/profile') },
        { label: 'Back to season', url: getAbsoluteUrl('/predictions'), tone: 'secondary' },
      ],
    })
  )
}

export async function GET(request: Request, context: RouteContext) {
  return handleRequest(request, context)
}

export async function POST(request: Request, context: RouteContext) {
  return handleRequest(request, context)
}
