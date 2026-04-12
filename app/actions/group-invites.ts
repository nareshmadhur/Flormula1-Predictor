'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAdminAccessContext } from '@/utils/admin-access'
import { generateInviteToken, getInvitePath, hashInviteToken } from '@/utils/group-invites'
import { getRequestOrigin } from '@/utils/request-url'
import type { GroupInviteActionState } from '@/app/admin/tenant/invite-action-state'
import type { JoinInviteActionState } from '@/app/join/[token]/action-state'

type InviteRpcResult = {
  status: string
  tenant_id?: string | null
  tenant_name?: string | null
  message?: string | null
}

async function getInviteAdminContext() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) throw new Error('Sign in before managing invites.')
  if (!access.isAdmin) throw new Error('Admin access is required to manage invites.')
  if (!access.tenantId) throw new Error('Join or select a group before creating invite links.')

  return { supabase, access }
}

function getPositiveInteger(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)

  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function getInviteErrorMessage(errorMessage: string) {
  const normalized = errorMessage.toLowerCase()

  if (
    normalized.includes('group_invites') ||
    normalized.includes('accept_group_invite') ||
    normalized.includes('get_group_invite_by_token')
  ) {
    return 'Invite links need the latest database update before they can be used.'
  }

  return errorMessage || 'Could not complete invite action.'
}

export async function createGroupInvite(
  _prevState: GroupInviteActionState,
  formData: FormData
): Promise<GroupInviteActionState> {
  try {
    const { supabase, access } = await getInviteAdminContext()
    const expiresInDays = getPositiveInteger(formData.get('expires_in_days'), 14, 1, 90)
    const maxUses = getPositiveInteger(formData.get('max_uses'), 50, 1, 500)
    const token = generateInviteToken()
    const tokenHash = hashInviteToken(token)
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase.from('group_invites').insert({
      tenant_id: access.tenantId,
      token_hash: tokenHash,
      created_by: access.userId,
      expires_at: expiresAt,
      max_uses: maxUses,
    })

    if (error) {
      return {
        status: 'error',
        message: getInviteErrorMessage(error.message),
      }
    }

    const origin = await getRequestOrigin()
    const inviteUrl = `${origin}${getInvitePath(token)}`

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

  const { data, error } = await supabase.rpc('accept_group_invite', {
    invite_token_hash: hashInviteToken(token),
  })

  if (error) {
    return {
      status: 'error',
      message: getInviteErrorMessage(error.message),
    }
  }

  const result = Array.isArray(data) ? (data[0] as InviteRpcResult | undefined) : undefined
  const status = result?.status

  if (status === 'joined' || status === 'already_member') {
    revalidatePath('/', 'layout')
    revalidatePath('/leaderboard')
    revalidatePath('/predictions')
    revalidatePath('/me/history')
    redirect('/leaderboard?view=tenant')
  }

  return {
    status: 'error',
    message: result?.message || 'This invite link could not be accepted.',
  }
}
