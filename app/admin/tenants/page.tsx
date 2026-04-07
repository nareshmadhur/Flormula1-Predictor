import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, ChevronLeft } from 'lucide-react'
import { getAdminAccessContext, resolveAdminScope, type AdminScope, type AdminProfileRow } from '@/utils/admin-access'
import { CreateTenantForm } from './create-tenant-form'
import { AccessWorkspace } from './access-workspace'

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
  const adminCountByTenant = new Map<string, number>()

  typedProfiles.forEach((entry) => {
    if (!entry.tenant_id) return
    if (entry.role === 'admin' && entry.admin_scope === 'tenant') {
      adminCountByTenant.set(entry.tenant_id, (adminCountByTenant.get(entry.tenant_id) || 0) + 1)
    } else {
      memberCountByTenant.set(entry.tenant_id, (memberCountByTenant.get(entry.tenant_id) || 0) + 1)
    }
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="mb-3 inline-flex items-center text-sm font-medium text-slate-400 hover:text-white">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Race Control
          </Link>
          <h1 className="flex items-center text-3xl font-black italic tracking-tighter text-red-500">
            <Building2 className="mr-3 h-8 w-8" /> GROUPS & ACCESS
          </h1>
          <p className="max-w-3xl text-slate-400">
            Assign people, keep groups healthy, and decide who runs the platform versus each group.
          </p>
        </div>
      </div>

      <AccessWorkspace
        profiles={typedProfiles}
        tenants={typedTenants}
        currentUserId={access.userId}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <section className="rounded-2xl border border-white/5 bg-card p-6 shadow-xl">
          <h2 className="mb-2 text-xl font-bold">Create group</h2>
          <p className="mb-4 text-sm text-slate-400">
            Add a new group first, then use the access workspace above to assign people into it.
          </p>
          <CreateTenantForm />
        </section>

        <section className="rounded-2xl border border-white/5 bg-card p-6 shadow-xl">
          <h2 className="mb-4 text-xl font-bold">Configured groups</h2>
          <div className="space-y-4">
            {typedTenants.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-black/30 px-4 py-3 text-sm text-slate-400">
                No groups created yet.
              </div>
            ) : (
              typedTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="rounded-2xl border border-white/5 bg-black/30 px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{tenant.name}</div>
                      <div className="mt-1 text-sm text-slate-400">{tenant.slug}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-white/6 px-3 py-1.5 text-slate-200">
                        {memberCountByTenant.get(tenant.id) || 0} members
                      </span>
                      <span className="rounded-full bg-white/6 px-3 py-1.5 text-slate-200">
                        {adminCountByTenant.get(tenant.id) || 0} admins
                      </span>
                      {(adminCountByTenant.get(tenant.id) || 0) === 0 && (
                        <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-amber-300">
                          No admin yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
