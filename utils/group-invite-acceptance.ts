import { hashInviteToken } from '@/utils/group-invites'
import { createClient } from '@/utils/supabase/server'

type InviteClient = Awaited<ReturnType<typeof createClient>>

export type InviteAcceptanceResult = {
  status: string
  tenantId: string | null
  tenantName: string | null
  message: string
}

type InviteRpcResult = {
  status: string
  tenant_id?: string | null
  tenant_name?: string | null
  message?: string | null
}

export function getInviteErrorMessage(errorMessage: string) {
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

export async function acceptInviteTokenForCurrentUser(
  supabase: InviteClient,
  token: string
): Promise<InviteAcceptanceResult> {
  const cleanToken = token.trim()

  if (!cleanToken) {
    return {
      status: 'invalid',
      tenantId: null,
      tenantName: null,
      message: 'Invite link is missing.',
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      status: 'auth_required',
      tenantId: null,
      tenantName: null,
      message: 'Sign in before joining this group.',
    }
  }

  const { data, error } = await supabase.rpc('accept_group_invite', {
    invite_token_hash: hashInviteToken(cleanToken),
  })

  if (error) {
    return {
      status: 'error',
      tenantId: null,
      tenantName: null,
      message: getInviteErrorMessage(error.message),
    }
  }

  const result = Array.isArray(data) ? (data[0] as InviteRpcResult | undefined) : undefined

  return {
    status: result?.status || 'error',
    tenantId: result?.tenant_id ?? null,
    tenantName: result?.tenant_name ?? null,
    message: result?.message || 'This invite link could not be accepted.',
  }
}
