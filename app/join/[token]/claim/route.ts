import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { acceptInviteTokenForCurrentUser } from '@/utils/group-invite-acceptance'
import { getInviteClaimPath, getInvitePath } from '@/utils/group-invites'
import { createClient } from '@/utils/supabase/server'

type RouteContext = {
  params: Promise<{ token: string }>
}

function redirectToJoin(request: Request, token: string, message?: string) {
  const url = new URL(getInvitePath(token), request.url)

  if (message) {
    url.searchParams.set('error', message)
  }

  return NextResponse.redirect(url)
}

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params
  const cleanToken = String(token ?? '').trim()
  const supabase = await createClient()
  const result = await acceptInviteTokenForCurrentUser(supabase, cleanToken)

  if (result.status === 'joined' || result.status === 'already_member') {
    revalidatePath('/', 'layout')
    revalidatePath('/leaderboard')
    revalidatePath('/predictions')
    revalidatePath('/me/history')

    const standingsUrl = new URL('/leaderboard', request.url)
    standingsUrl.searchParams.set('view', 'tenant')
    standingsUrl.searchParams.set(
      result.status === 'already_member' ? 'message' : 'joined',
      result.tenantName || 'group'
    )

    return NextResponse.redirect(standingsUrl)
  }

  if (result.status === 'auth_required') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', getInviteClaimPath(cleanToken))
    return NextResponse.redirect(loginUrl)
  }

  return redirectToJoin(request, cleanToken, result.message)
}
