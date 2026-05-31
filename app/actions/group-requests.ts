'use server'

import { revalidatePath } from 'next/cache'
import { assertPlatformAdmin } from '@/utils/admin-access'
import { sendGroupWelcomeEmail } from '@/utils/group-welcome-email'
import { isTestModeProfile } from '@/utils/test-mode'
import { createClient } from '@/utils/supabase/server'
import type { GroupRequestActionState } from '@/app/groups/request/action-state'

type ApproveGroupRequestRpcRow = {
  status?: string | null
  approved_tenant_id?: string | null
  approved_tenant_name?: string | null
  requester_id?: string | null
  message?: string | null
}

function getGroupRequestErrorMessage(errorMessage: string) {
  const normalized = errorMessage.toLowerCase()

  if (normalized.includes('group_requests') || normalized.includes('approve_group_request')) {
    return 'Group requests need the latest database update before they can be used.'
  }

  return errorMessage || 'Could not complete group request action.'
}

function revalidateGroupRequestPaths() {
  revalidatePath('/', 'layout')
  revalidatePath('/')
  revalidatePath('/groups/request')
  revalidatePath('/admin')
  revalidatePath('/admin/tenant')
  revalidatePath('/admin/tenants')
  revalidatePath('/leaderboard')
  revalidatePath('/predictions')
  revalidatePath('/me/history')
  revalidatePath('/me/profile')
}

function getExpectedPlayerCount(value: FormDataEntryValue | null) {
  const count = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(count) ? count : null
}

export async function submitGroupRequest(
  _prevState: GroupRequestActionState,
  formData: FormData
): Promise<GroupRequestActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: 'error', message: 'Sign in before requesting a private group.' }
  }

  const requestedName = String(formData.get('requested_name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const expectedPlayerCount = getExpectedPlayerCount(formData.get('expected_player_count'))
  const moveAcknowledged = formData.get('move_acknowledged') === 'on'

  if (requestedName.length < 3 || requestedName.length > 80) {
    return { status: 'error', message: 'Group name must be between 3 and 80 characters.' }
  }

  if (description && description.length > 500) {
    return { status: 'error', message: 'Group description must be 500 characters or fewer.' }
  }

  if (!expectedPlayerCount || expectedPlayerCount < 2 || expectedPlayerCount > 500) {
    return { status: 'error', message: 'Expected player count must be between 2 and 500.' }
  }

  if (!moveAcknowledged) {
    return { status: 'error', message: 'Confirm that approval will move your account into the new group.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return { status: 'error', message: 'Your account profile is not ready yet. Confirm your email and try again.' }
  }

  if (profile.role !== 'user') {
    return {
      status: 'error',
      message: 'Accounts that already manage a group need a platform admin to handle the move.',
    }
  }

  const { data: existingRequest, error: existingRequestError } = await supabase
    .from('group_requests')
    .select('id')
    .eq('requested_by', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingRequestError) {
    return { status: 'error', message: getGroupRequestErrorMessage(existingRequestError.message) }
  }

  if (existingRequest) {
    return { status: 'error', message: 'You already have a private-group request waiting for review.' }
  }

  const { error } = await supabase.from('group_requests').insert({
    requested_by: user.id,
    source_tenant_id: profile.tenant_id,
    requested_name: requestedName,
    description,
    expected_player_count: expectedPlayerCount,
    move_acknowledged_at: new Date().toISOString(),
  })

  if (error) {
    return { status: 'error', message: getGroupRequestErrorMessage(error.message) }
  }

  revalidatePath('/groups/request')
  revalidatePath('/admin/tenants')

  return {
    status: 'success',
    message: 'Private-group request sent. You can keep playing while a platform admin reviews it.',
  }
}

export async function approveGroupRequest(
  _prevState: GroupRequestActionState,
  formData: FormData
): Promise<GroupRequestActionState> {
  try {
    const { supabase } = await assertPlatformAdmin()
    const requestId = String(formData.get('request_id') ?? '').trim()
    const slug = String(formData.get('slug') ?? '').trim().toLowerCase()

    if (!requestId) {
      return { status: 'error', message: 'Group request is required.' }
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 60) {
      return {
        status: 'error',
        message: 'Use a 3-60 character slug with lowercase letters, numbers, and single hyphens.',
      }
    }

    const { data, error } = await supabase.rpc('approve_group_request', {
      group_request_id: requestId,
      group_slug: slug,
    })

    if (error) {
      return { status: 'error', message: getGroupRequestErrorMessage(error.message) }
    }

    const result = Array.isArray(data) ? (data[0] as ApproveGroupRequestRpcRow | undefined) : undefined

    if (result?.status !== 'approved' || !result.requester_id || !result.approved_tenant_name) {
      return {
        status: 'error',
        message: result?.message || 'Could not approve this group request.',
      }
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email, is_test, tenants(is_test)')
        .eq('id', result.requester_id)
        .maybeSingle()

      if (profile && !isTestModeProfile(profile)) {
        await sendGroupWelcomeEmail({
          email: profile.email,
          displayName: profile.display_name,
          groupName: result.approved_tenant_name,
          joinedVia: 'admin-moved',
        })
      }
    } catch (emailError) {
      console.error('Failed to send group welcome email after group request approval', emailError)
    }

    revalidateGroupRequestPaths()

    return {
      status: 'success',
      message: `${result.message || 'Group created.'} They can now create invite links from group ops.`,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not approve this group request.',
    }
  }
}

export async function rejectGroupRequest(
  _prevState: GroupRequestActionState,
  formData: FormData
): Promise<GroupRequestActionState> {
  try {
    const { supabase, access } = await assertPlatformAdmin()
    const requestId = String(formData.get('request_id') ?? '').trim()
    const reviewNote = String(formData.get('review_note') ?? '').trim()

    if (!requestId) {
      return { status: 'error', message: 'Group request is required.' }
    }

    if (reviewNote.length < 3 || reviewNote.length > 500) {
      return { status: 'error', message: 'Add a short 3-500 character note for the requester.' }
    }

    const { data, error } = await supabase
      .from('group_requests')
      .update({
        status: 'rejected',
        reviewed_by: access.userId,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (error) {
      return { status: 'error', message: getGroupRequestErrorMessage(error.message) }
    }

    if (!data) {
      return { status: 'error', message: 'This group request has already been reviewed.' }
    }

    revalidatePath('/groups/request')
    revalidatePath('/admin/tenants')

    return {
      status: 'success',
      message: 'Request closed. The requester can read your note and submit a fresh request.',
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not reject this group request.',
    }
  }
}
