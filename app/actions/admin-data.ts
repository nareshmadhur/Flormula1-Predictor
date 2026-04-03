'use server'

import { revalidatePath } from 'next/cache'
import {
  assertPlatformAdmin,
  resolveAdminScope,
  type AdminProfileRow,
  type AdminScope,
} from '@/utils/admin-access'
import { getCountryEmoji } from '@/utils/country-emoji'
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
        message: 'Tenant name and slug are required.',
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
      message: 'Tenant created successfully.',
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
    return 'Tenant admin access saved.'
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
      .select('id, role, tenant_id, admin_scope')
      .eq('id', profileId)
      .maybeSingle()

    if (!profile) {
      return {
        status: 'error',
        message: 'Target profile was not found.',
      }
    }

    if (tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .maybeSingle()

      if (!tenant) {
        return {
          status: 'error',
          message: 'Selected tenant was not found.',
        }
      }
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
          message: 'Tenant admins must be assigned to a tenant.',
        }
      }
    }

    if (
      profileId === access.userId &&
      (role !== currentRole || nextAdminScope !== currentAdminScope)
    ) {
      return {
        status: 'error',
        message: 'You can update your own tenant membership here, but not your own role or admin scope.',
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
