import { createClient } from '@/utils/supabase/server'

type AdminClient = Awaited<ReturnType<typeof createClient>>
export type AdminScope = 'platform' | 'tenant'

export type AdminProfileRow = {
  role?: 'user' | 'admin' | null
  tenant_id?: string | null
  admin_scope?: AdminScope | null
}

export type AdminAccessContext = {
  userId: string
  role: 'user' | 'admin' | null
  tenantId: string | null
  adminScope: AdminScope | null
  isAdmin: boolean
  isPlatformAdmin: boolean
  isTenantAdmin: boolean
}

export function resolveAdminScope(profile: AdminProfileRow | null | undefined): AdminScope | null {
  const role = profile?.role ?? null
  const tenantId = profile?.tenant_id ?? null

  if (profile?.admin_scope) return profile.admin_scope
  if (role !== 'admin') return null

  return tenantId ? 'tenant' : 'platform'
}

export async function getAdminAccessContext(supabase: AdminClient): Promise<AdminAccessContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  let profile: AdminProfileRow | null = null
  const query = await supabase
    .from('profiles')
    .select('role, tenant_id, admin_scope')
    .eq('id', user.id)
    .single()

  if (query.error && query.error.message?.includes('admin_scope')) {
    const legacyQuery = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    profile = (legacyQuery.data as AdminProfileRow | null) ?? null
  } else {
    profile = (query.data as AdminProfileRow | null) ?? null
  }

  const role = profile?.role ?? null
  const tenantId = profile?.tenant_id ?? null
  const adminScope = resolveAdminScope(profile)

  return {
    userId: user.id,
    role,
    tenantId,
    adminScope,
    isAdmin: role === 'admin',
    isPlatformAdmin: role === 'admin' && adminScope === 'platform',
    isTenantAdmin: role === 'admin' && adminScope === 'tenant',
  }
}

export async function assertPlatformAdmin() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) throw new Error('Unauthorized')
  if (!access.isPlatformAdmin) throw new Error('Forbidden')

  return { supabase, access }
}
