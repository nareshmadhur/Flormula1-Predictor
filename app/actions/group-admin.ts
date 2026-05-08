'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { getAdminAccessContext, resolveAdminScope, type AdminProfileRow } from '@/utils/admin-access'
import { getProfileDisplayName } from '@/utils/profile-name'
import { sendGroupWelcomeEmail } from '@/utils/group-welcome-email'
import type { GroupMemberActionState } from '@/app/admin/tenant/member-action-state'

type GroupMemberAction = 'promote' | 'demote' | 'move_to_main'

type ProfileAccessRow = AdminProfileRow & {
  id: string
  display_name?: string | null
  email?: string | null
  is_test?: boolean | null
}

type TenantRow = {
  id: string
  name: string
  slug: string
  is_test?: boolean | null
}

function getSubmittedAction(value: FormDataEntryValue | null): GroupMemberAction | null {
  if (value === 'promote' || value === 'demote' || value === 'move_to_main') return value
  return null
}

function getActionSuccessMessage(action: GroupMemberAction, profile: ProfileAccessRow, groupName: string) {
  const name = getProfileDisplayName(profile.display_name, profile.email, 'This member')

  if (action === 'promote') return `${name} can now help manage ${groupName}.`
  if (action === 'demote') return `${name} is now a group member.`
  return `${name} was moved to Main Group.`
}

function revalidateGroupAdminPaths() {
  revalidatePath('/admin/tenant')
  revalidatePath('/admin/tenants')
  revalidatePath('/leaderboard')
  revalidatePath('/predictions')
  revalidatePath('/me/history')
}

export async function updateGroupMemberAccess(
  _previousState: GroupMemberActionState,
  formData: FormData
): Promise<GroupMemberActionState> {
  try {
    const supabase = await createClient()
    const access = await getAdminAccessContext(supabase)

    if (!access) {
      return { status: 'error', message: 'Sign in before managing group members.' }
    }

    if (!access.isAdmin || !access.tenantId) {
      return { status: 'error', message: 'Group admin access is required.' }
    }

    const profileId = String(formData.get('profile_id') || '').trim()
    const action = getSubmittedAction(formData.get('member_action'))

    if (!profileId || !action) {
      return { status: 'error', message: 'Choose a valid member action.' }
    }

    if (profileId === access.userId) {
      return { status: 'error', message: 'Use another group admin account to change your own access.' }
    }

    let serviceSupabase: ReturnType<typeof createServiceRoleClient>
    try {
      serviceSupabase = createServiceRoleClient()
    } catch {
      return {
        status: 'error',
        message: 'Group access management is not configured for this environment yet.',
      }
    }

    const [{ data: profile }, { data: tenant }, { data: mainTenant }] = await Promise.all([
      serviceSupabase
        .from('profiles')
        .select('id, display_name, email, role, admin_scope, tenant_id, is_test')
        .eq('id', profileId)
        .maybeSingle(),
      serviceSupabase
        .from('tenants')
        .select('id, name, slug, is_test')
        .eq('id', access.tenantId)
        .maybeSingle(),
      serviceSupabase
        .from('tenants')
        .select('id, name, slug, is_test')
        .eq('slug', 'main')
        .maybeSingle(),
    ])

    if (!profile) {
      return { status: 'error', message: 'This member was not found.' }
    }

    const typedProfile = profile as ProfileAccessRow
    const typedTenant = tenant as TenantRow | null
    const typedMainTenant = mainTenant as TenantRow | null

    if (typedProfile.tenant_id !== access.tenantId) {
      return { status: 'error', message: 'You can only manage people in your own group.' }
    }

    const currentAdminScope = resolveAdminScope(typedProfile)

    if (typedProfile.role === 'admin' && currentAdminScope === 'platform') {
      return { status: 'error', message: 'Platform admin access can only be changed by platform admins.' }
    }

    const groupName = typedTenant?.name || 'this group'
    const { count: tenantAdminCount } = await serviceSupabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', access.tenantId)
      .eq('role', 'admin')
      .eq('admin_scope', 'tenant')

    if (
      (action === 'demote' || action === 'move_to_main') &&
      typedProfile.role === 'admin' &&
      currentAdminScope === 'tenant' &&
      (tenantAdminCount || 0) <= 1
    ) {
      return { status: 'error', message: 'Add another group admin before changing the last one.' }
    }

    if (action === 'move_to_main') {
      if (typedTenant?.slug === 'main') {
        return { status: 'error', message: 'This member is already in Main Group.' }
      }

      if (!typedMainTenant) {
        return { status: 'error', message: 'Main Group was not found.' }
      }
    }

    const nextAccess =
      action === 'promote'
        ? { role: 'admin' as const, admin_scope: 'tenant' as const, tenant_id: access.tenantId }
        : action === 'move_to_main'
          ? { role: 'user' as const, admin_scope: null, tenant_id: typedMainTenant?.id }
          : { role: 'user' as const, admin_scope: null, tenant_id: access.tenantId }

    const { error } = await serviceSupabase
      .from('profiles')
      .update(nextAccess)
      .eq('id', profileId)

    if (error) {
      return { status: 'error', message: `Could not update member access: ${error.message}` }
    }

    if (
      action === 'move_to_main' &&
      typedMainTenant &&
      !typedProfile.is_test &&
      !typedTenant?.is_test &&
      !typedMainTenant.is_test
    ) {
      try {
        await sendGroupWelcomeEmail({
          email: typedProfile.email,
          displayName: typedProfile.display_name,
          groupName: typedMainTenant.name,
          joinedVia: 'admin-moved',
        })
      } catch (emailError) {
        console.error('Failed to send group move email after group admin access update', emailError)
      }
    }

    revalidateGroupAdminPaths()

    return {
      status: 'success',
      message: getActionSuccessMessage(action, typedProfile, groupName),
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not update group member access.',
    }
  }
}
