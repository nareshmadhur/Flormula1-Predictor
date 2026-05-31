'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAdminAccessContext } from '@/utils/admin-access'
import { generateInviteToken, getInvitePath, hashInviteToken } from '@/utils/group-invites'
import { acceptInviteTokenForCurrentUser, getInviteErrorMessage } from '@/utils/group-invite-acceptance'
import { sendGroupWelcomeEmail } from '@/utils/group-welcome-email'
import { isTestModeProfile } from '@/utils/test-mode'
import { getAbsoluteUrl } from '@/utils/site'
import type { GroupInviteActionState } from '@/app/admin/tenant/invite-action-state'
import type { JoinInviteActionState } from '@/app/join/[token]/action-state'

type InviteAdminClient = Awaited<ReturnType<typeof createClient>>

async function getInviteAdminContext() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) throw new Error('Sign in before managing invites.')
  if (!access.isAdmin) throw new Error('Admin access is required to manage invites.')
  if (!access.tenantId) throw new Error('Join or select a group before creating invite links.')

  return { supabase, access }
}

async function createInviteRecord(
  supabase: InviteAdminClient,
  tenantId: string,
  createdBy: string,
  expiresAt: string,
  maxUses: number
) {
  const token = generateInviteToken()
  const tokenHash = hashInviteToken(token)

  const { error } = await supabase.from('group_invites').insert({
    tenant_id: tenantId,
    token_hash: tokenHash,
    share_token: token,
    created_by: createdBy,
    expires_at: expiresAt,
    max_uses: maxUses,
  })

  return {
    error,
    inviteUrl: getAbsoluteUrl(getInvitePath(token)),
  }
}

function getPositiveInteger(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)

  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

export async function createGroupInvite(
  _prevState: GroupInviteActionState,
  formData: FormData
): Promise<GroupInviteActionState> {
  try {
    const { supabase, access } = await getInviteAdminContext()
    const tenantId = access.tenantId

    if (!tenantId) {
      return {
        status: 'error',
        message: 'Join or select a group before creating invite links.',
      }
    }

    const expiresInDays = getPositiveInteger(formData.get('expires_in_days'), 14, 1, 90)
    const maxUses = getPositiveInteger(formData.get('max_uses'), 50, 1, 500)
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

    const { error, inviteUrl } = await createInviteRecord(
      supabase,
      tenantId,
      access.userId,
      expiresAt,
      maxUses
    )

    if (error) {
      return {
        status: 'error',
        message: getInviteErrorMessage(error.message),
      }
    }

    revalidatePath('/admin/tenant')

    return {
      status: 'success',
      message: 'Invite link created. Share it with people you want in this group.',
      inviteUrl,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? getInviteErrorMessage(error.message) : 'Could not create invite link.',
    }
  }
}

export async function createCopyableGroupInvite(
  _prevState: GroupInviteActionState,
  formData: FormData
): Promise<GroupInviteActionState> {
  try {
    const { supabase, access } = await getInviteAdminContext()
    const inviteId = String(formData.get('invite_id') ?? '').trim()

    if (!inviteId) {
      return {
        status: 'error',
        message: 'Invite link is required.',
      }
    }

    const { data: sourceInvite, error: sourceError } = await supabase
      .from('group_invites')
      .select('id, tenant_id, expires_at, max_uses, accepted_count, revoked_at')
      .eq('id', inviteId)
      .maybeSingle()

    if (sourceError) {
      return {
        status: 'error',
        message: getInviteErrorMessage(sourceError.message),
      }
    }

    if (!sourceInvite) {
      return {
        status: 'error',
        message: 'This invite link was not found.',
      }
    }

    if (!access.isPlatformAdmin && sourceInvite.tenant_id !== access.tenantId) {
      return {
        status: 'error',
        message: 'You can only create invite links for your own group.',
      }
    }

    if (sourceInvite.revoked_at) {
      return {
        status: 'error',
        message: 'This invite is already closed. Create a fresh invite instead.',
      }
    }

    if (new Date(sourceInvite.expires_at).getTime() <= Date.now()) {
      return {
        status: 'error',
        message: 'This invite has expired. Create a fresh invite instead.',
      }
    }

    if (sourceInvite.accepted_count >= sourceInvite.max_uses) {
      return {
        status: 'error',
        message: 'This invite is full. Create a fresh invite instead.',
      }
    }

    const remainingUses = Math.max(1, sourceInvite.max_uses - sourceInvite.accepted_count)
    const { error, inviteUrl } = await createInviteRecord(
      supabase,
      sourceInvite.tenant_id,
      access.userId,
      sourceInvite.expires_at,
      remainingUses
    )

    if (error) {
      return {
        status: 'error',
        message: getInviteErrorMessage(error.message),
      }
    }

    revalidatePath('/admin/tenant')

    return {
      status: 'success',
      message: 'Copyable invite created. The older link still works until it expires or you revoke it.',
      inviteUrl,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? getInviteErrorMessage(error.message) : 'Could not create invite link.',
    }
  }
}

export async function revokeGroupInvite(
  _prevState: GroupInviteActionState,
  formData: FormData
): Promise<GroupInviteActionState> {
  try {
    const { supabase } = await getInviteAdminContext()
    const inviteId = String(formData.get('invite_id') ?? '').trim()

    if (!inviteId) {
      return {
        status: 'error',
        message: 'Invite link is required.',
      }
    }

    const { data, error } = await supabase
      .from('group_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        status: 'error',
        message: getInviteErrorMessage(error.message),
      }
    }

    if (!data) {
      return {
        status: 'error',
        message: 'This invite was already inactive or could not be changed.',
      }
    }

    revalidatePath('/admin/tenant')

    return {
      status: 'success',
      message: 'Invite link revoked.',
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? getInviteErrorMessage(error.message) : 'Could not revoke invite link.',
    }
  }
}

export async function acceptGroupInvite(
  _prevState: JoinInviteActionState,
  formData: FormData
): Promise<JoinInviteActionState> {
  const token = String(formData.get('token') ?? '').trim()

  if (!token) {
    return {
      status: 'error',
      message: 'Invite link is missing.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      status: 'error',
      message: 'Sign in before joining this group.',
    }
  }

  const result = await acceptInviteTokenForCurrentUser(supabase, token)
  const status = result.status

  if (status === 'joined') {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email, is_test, tenants(is_test)')
        .eq('id', user.id)
        .maybeSingle()

      if (profile && !isTestModeProfile(profile)) {
        await sendGroupWelcomeEmail({
          email: profile.email,
          displayName: profile.display_name,
          groupName: result.tenantName || 'your group',
          joinedVia: 'invite',
        })
      }
    } catch (error) {
      console.error('Failed to send group welcome email after invite join', error)
    }
  }

  if (status === 'joined' || status === 'already_member') {
    revalidatePath('/', 'layout')
    revalidatePath('/leaderboard')
    revalidatePath('/predictions')
    revalidatePath('/me/history')
    redirect(`/predictions?joined=${encodeURIComponent(result.tenantName || 'your group')}`)
  }

  return {
    status: 'error',
    message: result.message || 'This invite link could not be accepted.',
  }
}
