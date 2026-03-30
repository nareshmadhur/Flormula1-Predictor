import { createClient } from '@/utils/supabase/server'

type TenantClient = Awaited<ReturnType<typeof createClient>>

type TenantContext = {
  tenantId: string | null
  tenantName: string | null
  tenantSlug: string | null
  role: 'user' | 'admin' | null
}

type ProfileTenantRow = {
  tenant_id: string | null
  role?: 'user' | 'admin' | null
  tenants?: Array<{
    name?: string | null
    slug?: string | null
  }> | null
}

export async function getUserTenantContext(supabase: TenantClient, userId: string): Promise<TenantContext> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tenant_id, role, tenants(name, slug)')
    .eq('id', userId)
    .single()

  if (error) {
    return {
      tenantId: null,
      tenantName: null,
      tenantSlug: null,
      role: null,
    }
  }

  const typedProfile = profile as ProfileTenantRow | null
  const tenant = typedProfile?.tenants?.[0]

  return {
    tenantId: typedProfile?.tenant_id ?? null,
    tenantName: tenant?.name ?? null,
    tenantSlug: tenant?.slug ?? null,
    role: typedProfile?.role ?? null,
  }
}
