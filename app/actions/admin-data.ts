'use server'

import { revalidatePath } from 'next/cache'
import {
  assertPlatformAdmin,
  resolveAdminScope,
  type AdminProfileRow,
  type AdminScope,
} from '@/utils/admin-access'
import { getCountryEmoji } from '@/utils/country-emoji'
import { sendGroupWelcomeEmail } from '@/utils/group-welcome-email'
import type { TenantAdminActionState } from '@/app/admin/tenants/action-state'

export async function addDriver(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()
  const code = formData.get('code') as string
  const fullName = formData.get('full_name') as string
  const emoji = formData.get('emoji') as string
  const constructorId = formData.get('constructor_id') as string

  if (!code || !fullName || !constructorId) throw new Error('Missing required fields')

  const { error } = await supabase.from('drivers').insert({
    code, full_name: fullName, emoji: emoji || '', constructor_id: constructorId, active: true
  })

  if (error) throw new Error('Failed to add driver: ' + error.message)
  revalidatePath('/admin/data')
}

export async function addConstructor(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()
  const name = (formData.get('name') as string | null)?.trim()
  const shortCode = (formData.get('short_code') as string | null)?.trim().toUpperCase()
  const emoji = (formData.get('emoji') as string | null)?.trim() || null

  if (!name || !shortCode) throw new Error('Constructor name and short code are required')

  const { data: existingConstructors } = await supabase
    .from('constructors')
    .select('id, name, short_code')
    .order('name')

  const normalizedName = name.toLowerCase()
  const normalizedCode = shortCode.toLowerCase()
  const duplicate = (existingConstructors || []).find((constructor) => (
    constructor.name.toLowerCase() === normalizedName ||
    constructor.short_code.toLowerCase() === normalizedCode
  ))

  if (duplicate) {
    throw new Error('That constructor already exists in reference data.')
  }

  const { error } = await supabase.from('constructors').insert({
    name,
    short_code: shortCode,
    emoji,
  })

  if (error) throw new Error('Failed to add constructor: ' + error.message)
  revalidatePath('/admin/data')
}

export async function updateConstructor(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()
  const constructorId = (formData.get('constructor_id') as string | null)?.trim()
  const name = (formData.get('name') as string | null)?.trim()
  const shortCode = (formData.get('short_code') as string | null)?.trim().toUpperCase()
  const emoji = (formData.get('emoji') as string | null)?.trim() || null

  if (!constructorId) throw new Error('Constructor ID is required')
  if (!name || !shortCode) throw new Error('Constructor name and short code are required')

  const { data: existingConstructors } = await supabase
    .from('constructors')
    .select('id, name, short_code')
    .neq('id', constructorId)

  const normalizedName = name.toLowerCase()
  const normalizedCode = shortCode.toLowerCase()
  const duplicate = (existingConstructors || []).find((constructor) => (
    constructor.name.toLowerCase() === normalizedName ||
    constructor.short_code.toLowerCase() === normalizedCode
  ))

  if (duplicate) {
    throw new Error('Another constructor already uses that name or short code.')
  }

  const { error } = await supabase
    .from('constructors')
    .update({
      name,
      short_code: shortCode,
      emoji,
    })
    .eq('id', constructorId)

  if (error) throw new Error('Failed to update constructor: ' + error.message)

  revalidatePath('/admin/data')
  revalidatePath('/admin/races')
  revalidatePath('/admin/tenant')
}

export async function deleteConstructor(constructorId: string) {
  const { supabase } = await assertPlatformAdmin()
  const id = constructorId.trim()

  if (!id) throw new Error('Constructor ID is required')

  const [{ count: driverCount, error: driverCountError }, { count: bonusOptionCount, error: bonusOptionCountError }] =
    await Promise.all([
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('constructor_id', id),
      supabase
        .from('bonus_options')
        .select('id', { count: 'exact', head: true })
        .eq('constructor_id', id),
    ])

  if (driverCountError) throw new Error('Could not check linked drivers: ' + driverCountError.message)
  if (bonusOptionCountError) throw new Error('Could not check linked bonus options: ' + bonusOptionCountError.message)

  if ((driverCount || 0) > 0 || (bonusOptionCount || 0) > 0) {
    throw new Error(
      `Cannot delete this constructor while it is used by ${driverCount || 0} driver${driverCount === 1 ? '' : 's'} and ${bonusOptionCount || 0} bonus option${bonusOptionCount === 1 ? '' : 's'}.`
    )
  }

  const { error } = await supabase.from('constructors').delete().eq('id', id)

  if (error) throw new Error('Failed to delete constructor: ' + error.message)

  revalidatePath('/admin/data')
}

export async function addCircuit(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()
  const name = (formData.get('name') as string | null)?.trim()
  const city = (formData.get('city') as string | null)?.trim() || null
  const country = (formData.get('country') as string | null)?.trim() || null
  const emoji = (formData.get('emoji') as string | null)?.trim() || getCountryEmoji(country)

  if (!name) throw new Error('Circuit name is required')

  const { data: existingCircuits } = await supabase
    .from('circuits')
    .select('id, name, city, country')
    .order('name')

  const normalizedName = name.toLowerCase()
  const normalizedCity = city?.toLowerCase() || ''
  const normalizedCountry = country?.toLowerCase() || ''

  const duplicate = (existingCircuits || []).find((circuit) => {
    return (
      circuit.name.toLowerCase() === normalizedName &&
      (circuit.city || '').toLowerCase() === normalizedCity &&
      (circuit.country || '').toLowerCase() === normalizedCountry
    )
  })

  if (duplicate) {
    throw new Error('That circuit already exists in reference data.')
  }

  const { error } = await supabase.from('circuits').insert({
    name,
    city,
    country,
    emoji,
  })

  if (error) throw new Error('Failed to add circuit: ' + error.message)
  revalidatePath('/admin/data')
  revalidatePath('/admin/schedule')
}

export async function updateCircuit(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()
  const circuitId = (formData.get('circuit_id') as string | null)?.trim()
  const name = (formData.get('name') as string | null)?.trim()
  const city = (formData.get('city') as string | null)?.trim() || null
  const country = (formData.get('country') as string | null)?.trim() || null
  const rawEmoji = (formData.get('emoji') as string | null)?.trim()
  const emoji = rawEmoji || getCountryEmoji(country)

  if (!circuitId) throw new Error('Circuit ID is required')
  if (!name) throw new Error('Circuit name is required')

  const { error } = await supabase
    .from('circuits')
    .update({
      name,
      city,
      country,
      emoji,
    })
    .eq('id', circuitId)

  if (error) throw new Error('Failed to update circuit: ' + error.message)

  revalidatePath('/admin')
  revalidatePath('/admin/data')
  revalidatePath('/admin/schedule')
  revalidatePath('/')
  revalidatePath('/season')
  revalidatePath('/predictions')
  revalidatePath('/leaderboard')
}

export async function toggleDriverActive(driverId: string, currentActive: boolean) {
  const { supabase } = await assertPlatformAdmin()
  const { error } = await supabase.from('drivers').update({ active: !currentActive }).eq('id', driverId)
  if (error) throw new Error('Failed to update driver')
  revalidatePath('/admin/data')
}

export async function toggleTenantTestMode(tenantId: string, currentIsTest: boolean) {
  const { supabase } = await assertPlatformAdmin()
  const { error } = await supabase
    .from('tenants')
    .update({ is_test: !currentIsTest })
    .eq('id', tenantId)

  if (error) throw new Error('Failed to update group test mode: ' + error.message)

  revalidatePath('/admin')
  revalidatePath('/admin/tenants')
  revalidatePath('/admin/tenant')
  revalidatePath('/')
  revalidatePath('/leaderboard')
  revalidatePath('/season')
}

export async function toggleProfileTestMode(profileId: string, currentIsTest: boolean) {
  const { supabase, access } = await assertPlatformAdmin()

  if (profileId === access.userId) {
    throw new Error('Use another platform admin account if you need to mark your own account as test.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_test: !currentIsTest })
    .eq('id', profileId)

  if (error) throw new Error('Failed to update user test mode: ' + error.message)

  revalidatePath('/admin')
  revalidatePath('/admin/tenants')
  revalidatePath('/admin/tenant')
  revalidatePath('/')
  revalidatePath('/leaderboard')
  revalidatePath('/season')
  revalidatePath('/predictions')
  revalidatePath('/me/history')
}

export async function deleteDriver(driverId: string) {
  const { supabase } = await assertPlatformAdmin()
  const { error } = await supabase.from('drivers').delete().eq('id', driverId)
  if (error) throw new Error('Failed to delete driver. Ensure no predictions depend on this driver first.')
  revalidatePath('/admin/data')
}

export async function createTenant(
  _prevState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
  try {
    const { supabase } = await assertPlatformAdmin()
    const name = (formData.get('name') as string)?.trim()
    const slug = (formData.get('slug') as string)?.trim().toLowerCase()

    if (!name || !slug) {
      return {
        status: 'error',
        message: 'Group name and slug are required.',
      }
    }

    const { error } = await supabase.from('tenants').insert({ name, slug })
    if (error) {
      return {
        status: 'error',
        message: `Failed to create tenant: ${error.message}`,
      }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/tenants')

    return {
      status: 'success',
      message: 'Group created successfully.',
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create tenant.',
    }
  }
}

function getAccessSaveMessage(role: 'user' | 'admin', adminScope: AdminScope | null, tenantId: string | null) {
  if (role === 'admin' && adminScope === 'platform') {
    return 'Platform admin access saved.'
  }

  if (role === 'admin' && adminScope === 'tenant') {
    return 'Group admin access saved.'
  }

  if (tenantId) {
    return 'Member access saved.'
  }

  return 'User is now unassigned.'
}

export async function updateProfileAccess(
  _prevState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
  try {
    const { supabase, access } = await assertPlatformAdmin()
    const profileId = formData.get('profile_id') as string
    const submittedRole = formData.get('role') as string | null
    const submittedAdminScope = formData.get('admin_scope') as string | null
    const tenantIdRaw = formData.get('tenant_id') as string | null
    const tenantId = tenantIdRaw?.trim() ? tenantIdRaw : null

    if (!profileId) {
      return {
        status: 'error',
        message: 'Profile is required.',
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, tenant_id, admin_scope, display_name, email, is_test')
      .eq('id', profileId)
      .maybeSingle()

    if (!profile) {
      return {
        status: 'error',
        message: 'Target profile was not found.',
      }
    }

    let selectedTenant: { id: string; name?: string | null; is_test?: boolean | null } | null = null

    if (tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name, is_test')
        .eq('id', tenantId)
        .maybeSingle()

      if (!tenant) {
        return {
          status: 'error',
          message: 'Selected group was not found.',
        }
      }

      selectedTenant = tenant
    }

    const currentRole = (profile as AdminProfileRow).role ?? null
    const currentAdminScope = resolveAdminScope(profile as AdminProfileRow)
    const role =
      submittedRole === 'user' || submittedRole === 'admin'
        ? submittedRole
        : currentRole

    if (role !== 'user' && role !== 'admin') {
      return {
        status: 'error',
        message: 'Role must be user or admin.',
      }
    }

    let nextAdminScope: AdminScope | null = null

    if (role === 'admin') {
      const requestedAdminScope =
        submittedAdminScope === 'platform' || submittedAdminScope === 'tenant'
          ? submittedAdminScope
          : currentAdminScope

      if (requestedAdminScope !== 'platform' && requestedAdminScope !== 'tenant') {
        return {
          status: 'error',
          message: 'Admin scope must be platform or tenant.',
        }
      }

      nextAdminScope = requestedAdminScope

      if (nextAdminScope === 'tenant' && !tenantId) {
        return {
          status: 'error',
          message: 'Group admins must be assigned to a group.',
        }
      }
    }

    if (
      profileId === access.userId &&
      (role !== currentRole || nextAdminScope !== currentAdminScope)
    ) {
      return {
        status: 'error',
        message: 'You can update your own group here, but not your own role or scope.',
      }
    }

    let updateResult = await supabase
      .from('profiles')
      .update({ role, tenant_id: tenantId, admin_scope: nextAdminScope })
      .eq('id', profileId)
      .select('id')
      .maybeSingle()

    if (updateResult.error && updateResult.error.message?.includes('admin_scope')) {
      updateResult = await supabase
        .from('profiles')
        .update({ role, tenant_id: tenantId })
        .eq('id', profileId)
        .select('id')
        .maybeSingle()
    }

    if (updateResult.error) {
      return {
        status: 'error',
        message: `Failed to save access: ${updateResult.error.message}`,
      }
    }

    if (!updateResult.data) {
      return {
        status: 'error',
        message: 'No profile was updated. Check row-level security and try again.',
      }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/tenants')
    revalidatePath('/leaderboard')
    revalidatePath('/predictions')
    revalidatePath('/me/history')

    const previousTenantId = (profile as AdminProfileRow).tenant_id ?? null
    const joinedVia =
      previousTenantId && previousTenantId !== tenantId ? 'admin-moved' : 'admin-assigned'

    if (
      tenantId &&
      previousTenantId !== tenantId &&
      !profile.is_test &&
      !selectedTenant?.is_test
    ) {
      try {
        await sendGroupWelcomeEmail({
          email: profile.email,
          displayName: profile.display_name,
          groupName: selectedTenant?.name || 'your group',
          joinedVia,
        })
      } catch (error) {
        console.error('Failed to send group welcome email after admin access update', error)
      }
    }

    return {
      status: 'success',
      message: getAccessSaveMessage(role, nextAdminScope, tenantId),
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to save access.',
    }
  }
}

export async function assignProfileTenant(
  prevState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
  return updateProfileAccess(prevState, formData)
}
