import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { resolveAdminScope, type AdminProfileRow } from '@/utils/admin-access'
import { createClient } from '@/utils/supabase/server'
import { hasSupabaseAuthCookie } from '@/utils/supabase/auth-cookie'
import { cookies } from 'next/headers'

type ServerClient = Awaited<ReturnType<typeof createClient>>

type RelatedTenant = {
  name?: string | null
  slug?: string | null
}

export type RequestProfile = AdminProfileRow & {
  display_name?: string | null
  email?: string | null
  tenants?: RelatedTenant | RelatedTenant[] | null
}

export type RequestUserContext = {
  supabase: ServerClient
  user: User | null
  profile: RequestProfile | null
  tenantContext: {
    tenantId: string | null
    tenantName: string | null
    tenantSlug: string | null
    role: 'user' | 'admin' | null
  }
  isAdmin: boolean
  isPlatformAdmin: boolean
  isTenantAdmin: boolean
}

function getRelatedTenant(value: RelatedTenant | RelatedTenant[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null
}

/**
 * Request-scoped identity lookup shared by the root navigation and user pages.
 * React cache() deduplicates this work during one server render without making
 * profile or tenant data globally cacheable between users.
 */
export const getRequestUserContext = cache(async (): Promise<RequestUserContext> => {
  const cookieStore = await cookies()
  const supabase = await createClient()

  if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
    return {
      supabase,
      user: null,
      profile: null,
      tenantContext: {
        tenantId: null,
        tenantName: null,
        tenantSlug: null,
        role: null,
      },
      isAdmin: false,
      isPlatformAdmin: false,
      isTenantAdmin: false,
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null,
      tenantContext: {
        tenantId: null,
        tenantName: null,
        tenantSlug: null,
        role: null,
      },
      isAdmin: false,
      isPlatformAdmin: false,
      isTenantAdmin: false,
    }
  }

  const profileQuery = await supabase
    .from('profiles')
    .select('display_name, email, role, tenant_id, admin_scope, tenants(name, slug)')
    .eq('id', user.id)
    .maybeSingle()

  const legacyProfileQuery = profileQuery.error?.message?.includes('admin_scope')
    ? await supabase
        .from('profiles')
        .select('display_name, email, role, tenant_id, tenants(name, slug)')
        .eq('id', user.id)
        .maybeSingle()
    : null
  const profile = (legacyProfileQuery?.data || profileQuery.data) as RequestProfile | null
  const tenant = getRelatedTenant(profile?.tenants)
  const role = profile?.role ?? null
  const adminScope = resolveAdminScope(profile)

  return {
    supabase,
    user,
    profile,
    tenantContext: {
      tenantId: profile?.tenant_id ?? null,
      tenantName: tenant?.name ?? null,
      tenantSlug: tenant?.slug ?? null,
      role,
    },
    isAdmin: role === 'admin',
    isPlatformAdmin: role === 'admin' && adminScope === 'platform',
    isTenantAdmin: role === 'admin' && adminScope === 'tenant',
  }
})
