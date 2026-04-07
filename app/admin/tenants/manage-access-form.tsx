'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
  expanded: boolean
  onToggle: () => void
}

function SubmitButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full whitespace-nowrap rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 font-bold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-400 sm:w-auto"
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
      : `Group admin${tenantName ? ` · ${tenantName}` : ''}`
  }

  return tenantName ? `Member · ${tenantName}` : 'Needs assignment'
}

function getRowStatus(profile: Profile, currentUserId: string) {
  if (profile.id === currentUserId) {
    return {
      label: 'Self-edit locked',
      tone: 'bg-amber-500/10 text-amber-300',
    }
  }

  if (profile.role === 'user' && !profile.tenant_id) {
    return {
      label: 'Needs assignment',
      tone: 'bg-red-500/10 text-red-300',
    }
  }

  if (profile.role === 'admin' && profile.admin_scope === 'tenant' && !profile.tenant_id) {
    return {
      label: 'Needs group',
      tone: 'bg-red-500/10 text-red-300',
    }
  }

  return {
    label: 'Configured',
    tone: 'bg-white/6 text-slate-300',
  }
}

export function ManageAccessForm({
  profile,
  tenants,
  currentUserId,
  expanded,
  onToggle,
}: ManageAccessFormProps) {
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
  const rowStatus = getRowStatus(profile, currentUserId)
  const currentAccessLabel = getCurrentAccessLabel(profile, tenants)
  const actionLabel = profile.role === 'user' && !profile.tenant_id ? 'Assign' : 'Edit'

  return (
    <form action={formAction} className="rounded-2xl border border-white/5 bg-black/25 p-3.5 sm:p-4">
      <input type="hidden" name="profile_id" value={profile.id} />
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(12rem,1.05fr)_minmax(10rem,0.8fr)_auto] md:items-center">
          <div className="min-w-0">
            <div className="truncate font-semibold text-white">
              {getProfileDisplayName(profile.display_name, profile.email, 'Unnamed user')}
            </div>
            <div className="break-all text-xs text-slate-400 sm:text-sm">
              {profile.email || 'No email'}
            </div>
          </div>

          <div>
            <div className="inline-flex w-fit rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-semibold text-slate-200 sm:px-3 sm:py-1.5 sm:text-xs">
              {currentAccessLabel}
            </div>
          </div>

          <div>
            <div className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:py-1.5 sm:text-xs ${rowStatus.tone}`}>
              {rowStatus.label}
            </div>
          </div>

          <div className="flex md:justify-end">
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black/40 md:w-auto"
            >
              {actionLabel}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <div className="grid gap-3 md:grid-cols-[0.9fr,0.9fr,1.2fr,auto] md:items-end">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Role
                </label>
                <select
                  name="role"
                  value={selectedRole}
                  onChange={(event) => {
                    const nextRole = event.target.value as 'user' | 'admin'
                    setSelectedRole(nextRole)
                  }}
                  disabled={roleScopeDisabled}
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Scope
                </label>
                {selectedRole === 'admin' ? (
                  <select
                    name="admin_scope"
                    value={selectedAdminScope}
                    onChange={(event) => {
                      const nextScope = event.target.value as 'platform' | 'tenant'
                      setSelectedAdminScope(nextScope)
                    }}
                    disabled={roleScopeDisabled}
                    className="w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm"
                  >
                    <option value="platform">Platform</option>
                    <option value="tenant">Tenant</option>
                  </select>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-500">
                    —
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Group
                </label>
                <select
                  name="tenant_id"
                  value={selectedTenantId}
                  onChange={(event) => setSelectedTenantId(event.target.value)}
                  disabled={tenantSelectionDisabled}
                  required={selectedRole === 'admin' && selectedAdminScope === 'tenant'}
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  <option value="">
                    {selectedRole === 'admin' && selectedAdminScope === 'tenant' ? 'Select group' : 'Unassigned'}
                  </option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end md:justify-end">
                <SubmitButton pending={pending} disabled={submitDisabled} />
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {isEditingSelf ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm font-medium text-amber-300">
                  Your own role and scope stay locked here, but you can still join a group and compete.
                </div>
              ) : selectedRole === 'admin' && selectedAdminScope === 'tenant' && !selectedTenantId ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-300">
                  Pick a group before saving group-admin access.
                </div>
              ) : selectedRole === 'user' && !selectedTenantId ? (
                <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2.5 text-sm text-slate-300">
                  This person can browse public standings, but picks and history stay locked until they join a group.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {state.message && (
        <div
          className={`mt-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
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
