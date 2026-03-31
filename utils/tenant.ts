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
}

type TenantRow = {
  name?: string | null
  slug?: string | null
}

export async function getUserTenantContext(supabase: TenantClient, userId: string): Promise<TenantContext> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return {
      tenantId: null,
      tenantName: null,
      tenantSlug: null,
      role: null,
    }
  }

  const typedProfile = profile as ProfileTenantRow
  let tenant: TenantRow | null = null

  if (typedProfile.tenant_id) {
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('name, slug')
      .eq('id', typedProfile.tenant_id)
      .maybeSingle()

    tenant = (tenantRow as TenantRow | null) ?? null
  }

  return {
    tenantId: typedProfile.tenant_id ?? null,
    tenantName: tenant?.name ?? null,
    tenantSlug: tenant?.slug ?? null,
    role: typedProfile.role ?? null,
  }
}
