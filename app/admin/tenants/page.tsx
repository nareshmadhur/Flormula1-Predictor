import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { getAdminAccessContext, resolveAdminScope, type AdminScope, type AdminProfileRow } from '@/utils/admin-access'
import { CreateTenantForm } from './create-tenant-form'
import { AccessWorkspace } from './access-workspace'
import { TestModeToggleButton } from './test-mode-toggle-button'
import { PageBackLink } from '@/components/ui/page-back-link'
import { GroupRequestReviewPanel } from './group-request-review-panel'

type Tenant = {
  id: string
  name: string
  slug: string
  is_test?: boolean | null
}

type Profile = {
  id: string
  display_name?: string | null
  email?: string | null
  role: 'user' | 'admin'
  admin_scope?: AdminScope | null
  tenant_id?: string | null
  is_test?: boolean | null
}

type GroupRequest = {
  id: string
  requested_by: string
  source_tenant_id?: string | null
  requested_name: string
  description?: string | null
  expected_player_count: number
  move_acknowledged_at: string
  created_at: string
}

export const revalidate = 0

export default async function AdminTenantsPage() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')

  if (!access.isPlatformAdmin) {
    return <div className="p-20 text-center text-red-500 font-bold">Platform admin access required.</div>
  }

  const tenantsWithTestMode = await supabase
    .from('tenants')
    .select('id, name, slug, is_test')
    .order('name')

  const tenantsResult = tenantsWithTestMode.error?.message?.includes('is_test')
    ? await supabase
        .from('tenants')
        .select('id, name, slug')
        .order('name')
    : tenantsWithTestMode

  const profilesWithScope = await supabase
    .from('profiles')
    .select('id, display_name, email, role, tenant_id, admin_scope, is_test')
    .order('display_name')

  const pendingGroupRequestsResult = await supabase
    .from('group_requests')
    .select('id, requested_by, source_tenant_id, requested_name, description, expected_player_count, move_acknowledged_at, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  let rawProfiles: Profile[] = []

  if (
    profilesWithScope.error &&
    (profilesWithScope.error.message?.includes('admin_scope') || profilesWithScope.error.message?.includes('is_test'))
  ) {
    const legacyProfiles = await supabase
      .from('profiles')
      .select('id, display_name, email, role, tenant_id')
      .order('display_name')

    rawProfiles = (legacyProfiles.data || []) as Profile[]
  } else {
    rawProfiles = (profilesWithScope.data || []) as Profile[]
  }

  const typedTenants = ((tenantsResult.data || []) as Tenant[]).map((tenant) => ({
    ...tenant,
    is_test: tenant.is_test ?? false,
  }))
  const typedProfiles = rawProfiles.map((profile) => ({
    ...profile,
    admin_scope: resolveAdminScope(profile as AdminProfileRow),
    is_test: profile.is_test ?? false,
  }))
  const testModeAvailable = !tenantsWithTestMode.error && !profilesWithScope.error
  const groupRequestSetupMessage = pendingGroupRequestsResult.error
    ? 'Group requests are not ready in this database yet. Run the latest group-request migration, then come back here.'
    : null
  const pendingGroupRequests = pendingGroupRequestsResult.error
    ? []
    : (pendingGroupRequestsResult.data || []) as GroupRequest[]
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
          <PageBackLink href="/admin" label="Back to Admin" />
          <h1 className="flex items-center text-3xl font-bold tracking-tight text-red-500">
            <Building2 className="mr-3 h-8 w-8" /> Groups and access
          </h1>
          <p className="max-w-3xl text-slate-400">
            Everyone starts in Main Group. Use this page to run private groups, invites, roles, and rare setup fixes.
          </p>
        </div>
      </div>

      <GroupRequestReviewPanel
        requests={pendingGroupRequests}
        profiles={typedProfiles}
        tenants={typedTenants}
        setupMessage={groupRequestSetupMessage}
      />

      <AccessWorkspace
        profiles={typedProfiles}
        tenants={typedTenants}
        currentUserId={access.userId}
        testModeAvailable={testModeAvailable}
      />

      <div className="space-y-6">
        <section className="rounded-2xl border border-white/5 bg-card p-6 shadow-xl">
          <h2 className="mb-2 text-xl font-bold">Create group</h2>
          <p className="mb-4 text-sm text-slate-400">
            Add a private group, then use invite links or the access workspace above to move people into it.
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
                      {tenant.is_test && (
                        <div className="mt-2 inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">
                          Test group
                        </div>
                      )}
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
                      {testModeAvailable && (
                        <TestModeToggleButton id={tenant.id} target="group" active={Boolean(tenant.is_test)} />
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
