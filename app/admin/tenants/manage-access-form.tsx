'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfileAccess } from '@/app/actions/admin-data'
import { getProfileDisplayName } from '@/utils/profile-name'
import { initialTenantAdminActionState } from './action-state'

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
  admin_scope?: 'platform' | 'tenant' | null
  tenant_id?: string | null
}

type ManageAccessFormProps = {
  profile: Profile
  tenants: Tenant[]
  currentUserId: string
}

function SubmitButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded-xl border border-white/10 bg-slate-800 px-4 py-3 font-bold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-400"
    >
      {pending ? 'Saving...' : 'Save Access'}
    </button>
  )
}

function getResolvedAdminScope(profile: Profile) {
  if (profile.role !== 'admin') return 'tenant'
  if (profile.admin_scope) return profile.admin_scope
  return profile.tenant_id ? 'tenant' : 'platform'
}

function getCurrentAccessLabel(profile: Profile, tenants: Tenant[]) {
  const tenantName = tenants.find((tenant) => tenant.id === profile.tenant_id)?.name

  if (profile.role === 'admin') {
    return getResolvedAdminScope(profile) === 'platform'
      ? tenantName
        ? `Platform admin · ${tenantName}`
        : 'Platform admin'
      : `Tenant admin${tenantName ? ` · ${tenantName}` : ''}`
  }

  return tenantName ? `Tenant member · ${tenantName}` : 'Unassigned user'
}

export function ManageAccessForm({ profile, tenants, currentUserId }: ManageAccessFormProps) {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin'>(profile.role)
  const [selectedAdminScope, setSelectedAdminScope] = useState<'platform' | 'tenant'>(
    getResolvedAdminScope(profile)
  )
  const [selectedTenantId, setSelectedTenantId] = useState(profile.tenant_id || '')
  const isEditingSelf = currentUserId === profile.id
  const [state, formAction, pending] = useActionState(
    updateProfileAccess,
    initialTenantAdminActionState
  )

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  const roleScopeDisabled = isEditingSelf || pending
  const tenantSelectionDisabled = pending
  const submitDisabled = pending

  return (
    <form action={formAction} className="rounded-2xl border border-white/5 bg-black/20 p-4">
      <input type="hidden" name="profile_id" value={profile.id} />
      <div className="flex flex-col gap-5">
        <div className="space-y-1">
          <div className="font-semibold text-white">
            {getProfileDisplayName(profile.display_name, profile.email, 'Unnamed user')}
          </div>
          <div className="text-sm text-slate-400">
            {profile.email || 'No email'} · {getCurrentAccessLabel(profile, tenants)}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.8fr,0.8fr,1.2fr,auto] lg:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Role</label>
            <select
              name="role"
              value={selectedRole}
              onChange={(event) => {
                const nextRole = event.target.value as 'user' | 'admin'
                setSelectedRole(nextRole)
              }}
              disabled={roleScopeDisabled}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Admin Scope</label>
            {selectedRole === 'admin' ? (
              <select
                name="admin_scope"
                value={selectedAdminScope}
                onChange={(event) => {
                  const nextScope = event.target.value as 'platform' | 'tenant'
                  setSelectedAdminScope(nextScope)
                }}
                disabled={roleScopeDisabled}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base"
              >
                <option value="platform">Platform</option>
                <option value="tenant">Tenant</option>
              </select>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-500">
                Only applies to admins
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Tenant</label>
            <select
              name="tenant_id"
              value={selectedTenantId}
              onChange={(event) => setSelectedTenantId(event.target.value)}
              disabled={tenantSelectionDisabled}
              required={selectedRole === 'admin' && selectedAdminScope === 'tenant'}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <option value="">
                {selectedRole === 'admin' && selectedAdminScope === 'tenant' ? 'Select tenant' : 'Unassigned'}
              </option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <SubmitButton pending={pending} disabled={submitDisabled} />
          </div>
        </div>

        {isEditingSelf ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">
            Your own role and admin scope stay locked here to prevent accidental lockout, but you can still choose a tenant and participate.
          </div>
        ) : selectedRole === 'admin' && selectedAdminScope === 'platform' ? (
          <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-300">
            Platform admins keep cross-tenant control and can still join a tenant if they want to compete.
          </div>
        ) : selectedRole === 'admin' ? (
          <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-300">
            Tenant admins are scoped to one tenant and are ready for tenant-level tooling in the next delivery slice.
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-300">
            Unassigned users can still view the global leaderboard, but predictions and history stay locked until they join a tenant.
          </div>
        )}
      </div>
      {state.message && (
        <div
          className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
            state.status === 'success'
              ? 'border border-green-500/20 bg-green-500/10 text-green-300'
              : 'border border-red-500/20 bg-red-500/10 text-red-300'
          }`}
        >
          {state.message}
        </div>
      )}
    </form>
  )
}
