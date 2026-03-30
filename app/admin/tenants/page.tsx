import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, ChevronLeft } from 'lucide-react'
import { getAdminAccessContext, resolveAdminScope, type AdminScope, type AdminProfileRow } from '@/utils/admin-access'
import { CreateTenantForm } from './create-tenant-form'
import { ManageAccessForm } from './manage-access-form'

type Tenant = {
  id: string
  name: string
  slug: string
}

type Profile = {
  id: string
  display_name?: string | null
  email?: string | null
  role: 'user' | 'admin'
  admin_scope?: AdminScope | null
  tenant_id?: string | null
}

export const revalidate = 0

export default async function AdminTenantsPage() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')

  if (!access.isPlatformAdmin) {
    return <div className="p-20 text-center text-red-500 font-bold">Platform admin access required.</div>
  }

  const { data: tenants } = await supabase
    .from('tenants')
    .select('*')
    .order('name')

  const profilesWithScope = await supabase
    .from('profiles')
    .select('id, display_name, email, role, tenant_id, admin_scope')
    .order('display_name')

  let rawProfiles: Profile[] = []

  if (profilesWithScope.error && profilesWithScope.error.message?.includes('admin_scope')) {
    const legacyProfiles = await supabase
      .from('profiles')
      .select('id, display_name, email, role, tenant_id')
      .order('display_name')

    rawProfiles = (legacyProfiles.data || []) as Profile[]
  } else {
    rawProfiles = (profilesWithScope.data || []) as Profile[]
  }

  const typedTenants = (tenants || []) as Tenant[]
  const typedProfiles = rawProfiles.map((profile) => ({
    ...profile,
    admin_scope: resolveAdminScope(profile as AdminProfileRow),
  }))
  const memberCountByTenant = new Map<string, number>()
  const platformAdminCount = typedProfiles.filter(
    (entry) => entry.role === 'admin' && entry.admin_scope === 'platform'
  ).length
  const tenantAdminCount = typedProfiles.filter(
    (entry) => entry.role === 'admin' && entry.admin_scope === 'tenant'
  ).length
  const unassignedCount = typedProfiles.filter(
    (entry) => entry.role === 'user' && !entry.tenant_id
  ).length

  typedProfiles.forEach((entry) => {
    if (!entry.tenant_id) return
    memberCountByTenant.set(entry.tenant_id, (memberCountByTenant.get(entry.tenant_id) || 0) + 1)
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="mb-3 inline-flex items-center text-sm font-medium text-slate-400 hover:text-white">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Race Control
          </Link>
          <h1 className="flex items-center text-3xl font-black italic tracking-tighter text-red-500">
            <Building2 className="mr-3 h-8 w-8" /> TENANTS & ACCESS
          </h1>
          <p className="text-slate-400">
            Create tenant spaces, manage account access, and keep platform-wide and tenant-scoped responsibilities explicit.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Tenants</div>
          <div className="mt-3 text-4xl font-black italic text-white">{typedTenants.length}</div>
          <p className="mt-2 text-sm text-slate-400">Shared race data feeds these competition spaces.</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Platform Admins</div>
          <div className="mt-3 text-4xl font-black italic text-white">{platformAdminCount}</div>
          <p className="mt-2 text-sm text-slate-400">Operate race control, scoring, and system-wide setup.</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Tenant Admins</div>
          <div className="mt-3 text-4xl font-black italic text-white">{tenantAdminCount}</div>
          <p className="mt-2 text-sm text-slate-400">Ready for tenant-level tooling without platform-wide access.</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Unassigned Users</div>
          <div className="mt-3 text-4xl font-black italic text-white">{unassignedCount}</div>
          <p className="mt-2 text-sm text-slate-400">Can browse global standings, but private competition pages stay locked.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.9fr,1.3fr]">
        <section className="rounded-2xl border border-white/5 bg-card p-6 shadow-xl">
          <h2 className="mb-4 text-xl font-bold">Create Tenant</h2>
          <CreateTenantForm />

          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Configured Tenants</h3>
            {typedTenants.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-black/30 px-4 py-3 text-sm text-slate-400">
                No tenants created yet.
              </div>
            ) : (
              typedTenants.map((tenant) => (
                <div key={tenant.id} className="rounded-xl border border-white/5 bg-black/30 px-4 py-3">
                  <div className="font-semibold text-white">{tenant.name}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {tenant.slug} · {memberCountByTenant.get(tenant.id) || 0} members
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-card p-6 shadow-xl">
          <h2 className="mb-2 text-xl font-bold">Manage Account Access</h2>
          <p className="mb-4 text-sm text-slate-400">
            Set role, admin scope, and tenant membership from one place. Platform admins can stay global-only or join a tenant and compete.
          </p>
          <div className="space-y-4">
            {typedProfiles.map((entry) => (
              <ManageAccessForm
                key={`${entry.id}:${entry.role}:${entry.admin_scope || 'none'}:${entry.tenant_id || 'unassigned'}`}
                profile={entry}
                tenants={typedTenants}
                currentUserId={access.userId}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
