'use client'

import { useState } from 'react'
import { AlertTriangle, Building2, FlaskConical, Shield, UserCheck, Users } from 'lucide-react'
import { ManageAccessForm } from './manage-access-form'

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
  admin_scope?: 'platform' | 'tenant' | null
  tenant_id?: string | null
  is_test?: boolean | null
  last_activity_at?: string | null
  last_login_at?: string | null
  last_prediction_at?: string | null
}

type AccessFilter = 'needs-assignment' | 'members' | 'group-admins' | 'platform-admins' | 'test' | 'all'

type AccessWorkspaceProps = {
  profiles: Profile[]
  tenants: Tenant[]
  currentUserId: string
  testModeAvailable: boolean
}

function getProfileName(profile: Profile) {
  return profile.display_name || profile.email || 'Unnamed user'
}

function sortProfiles(a: Profile, b: Profile) {
  const priority = (profile: Profile) => {
    if (profile.role === 'user' && !profile.tenant_id) return 0
    if (profile.role === 'admin' && profile.admin_scope === 'tenant') return 1
    if (profile.role === 'admin' && profile.admin_scope === 'platform') return 2
    return 3
  }

  const priorityDiff = priority(a) - priority(b)
  if (priorityDiff !== 0) return priorityDiff

  return getProfileName(a).localeCompare(getProfileName(b))
}

function matchesFilter(profile: Profile, filter: AccessFilter) {
  if (filter === 'needs-assignment') return profile.role === 'user' && !profile.tenant_id
  if (filter === 'members') return profile.role === 'user' && !!profile.tenant_id
  if (filter === 'group-admins') return profile.role === 'admin' && profile.admin_scope === 'tenant'
  if (filter === 'platform-admins') return profile.role === 'admin' && profile.admin_scope === 'platform'
  if (filter === 'test') return Boolean(profile.is_test)
  return true
}

export function AccessWorkspace({
  profiles,
  tenants,
  currentUserId,
  testModeAvailable,
}: AccessWorkspaceProps) {
  const testGroupIds = new Set(tenants.filter((tenant) => tenant.is_test).map((tenant) => tenant.id))
  const isProfileInTestMode = (profile: Profile) =>
    Boolean(profile.is_test || (profile.tenant_id && testGroupIds.has(profile.tenant_id)))
  const operationalProfiles = profiles.filter((profile) => !isProfileInTestMode(profile))
  const hiddenTestProfileCount = profiles.length - operationalProfiles.length
  const needsAssignmentCount = operationalProfiles.filter((profile) => profile.role === 'user' && !profile.tenant_id).length
  const memberCount = operationalProfiles.filter((profile) => profile.role === 'user' && !!profile.tenant_id).length
  const groupAdminCount = operationalProfiles.filter(
    (profile) => profile.role === 'admin' && profile.admin_scope === 'tenant'
  ).length
  const platformAdminCount = operationalProfiles.filter(
    (profile) => profile.role === 'admin' && profile.admin_scope === 'platform'
  ).length
  const testProfileCount = profiles.filter(isProfileInTestMode).length

  const groupStats = tenants
    .map((tenant) => {
      const scopedProfiles = profiles.filter(
        (profile) =>
          profile.tenant_id === tenant.id &&
          (tenant.is_test ? true : !isProfileInTestMode(profile))
      )
      const members = scopedProfiles.filter((profile) => profile.role === 'user').length
      const admins = scopedProfiles.filter(
        (profile) => profile.role === 'admin' && profile.admin_scope === 'tenant'
      ).length

      return {
        ...tenant,
        members,
        admins,
        total: members + admins,
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  const [activeFilter, setActiveFilter] = useState<AccessFilter>(
    needsAssignmentCount > 0 ? 'needs-assignment' : 'all'
  )
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [openProfileId, setOpenProfileId] = useState<string | null>(null)

  const normalizedQuery = query.trim().toLowerCase()
  const filteredProfiles = (activeFilter === 'test' ? profiles.filter(isProfileInTestMode) : operationalProfiles)
    .filter((profile) => (activeFilter === 'test' ? true : matchesFilter(profile, activeFilter)))
    .filter((profile) => (selectedGroupId ? profile.tenant_id === selectedGroupId : true))
    .filter((profile) => {
      if (!normalizedQuery) return true
      const haystack = `${profile.display_name || ''} ${profile.email || ''}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
    .sort(sortProfiles)

  const filterCards: Array<{
    id: AccessFilter
    label: string
    count: number
    tone: string
    icon: typeof AlertTriangle
    helper: string
  }> = [
    {
      id: 'needs-assignment',
      label: 'Needs group',
      count: needsAssignmentCount,
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
      icon: AlertTriangle,
      helper: 'Accounts missing Main Group or a private group.',
    },
    {
      id: 'members',
      label: 'Members',
      count: memberCount,
      tone: 'border-white/10 bg-white/5 text-slate-100',
      icon: Users,
      helper: 'Regular players already placed in a group.',
    },
    {
      id: 'group-admins',
      label: 'Group admins',
      count: groupAdminCount,
      tone: 'border-red-500/20 bg-red-500/10 text-red-200',
      icon: UserCheck,
      helper: 'Admins who only operate within one group.',
    },
    {
      id: 'platform-admins',
      label: 'Platform admins',
      count: platformAdminCount,
      tone: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
      icon: Shield,
      helper: 'Admins with full race-control access.',
    },
  ]

  if (testModeAvailable) {
    filterCards.push({
      id: 'test',
      label: 'Test mode',
      count: testProfileCount,
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
      icon: FlaskConical,
      helper: 'People excluded by their account or group test flag.',
    })
  }

  const activeGroup = selectedGroupId
    ? groupStats.find((group) => group.id === selectedGroupId) ?? null
    : null

  return (
    <section className="space-y-6 rounded-3xl border border-white/5 bg-card p-5 shadow-xl sm:p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Access map</h2>
        <p className="max-w-3xl text-sm text-slate-400">
          New users start in Main Group. Use this space to fix setup gaps, manage admins, or move people into private groups.
        </p>
        {hiddenTestProfileCount > 0 && (
          <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
            Operational views hide {hiddenTestProfileCount} test account{hiddenTestProfileCount === 1 ? '' : 's'} by default.
          </p>
        )}
        {!testModeAvailable && (
          <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Test mode needs the latest database update before groups or people can be marked as test.
          </p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr,1.35fr]">
        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">People flow</h3>
            <span className="text-xs text-slate-500">Click to filter</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filterCards.map((card) => {
              const Icon = card.icon
              const active = activeFilter === card.id
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActiveFilter(card.id)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    active
                      ? `${card.tone} shadow-[0_0_0_1px_rgba(255,255,255,0.06)]`
                      : 'border-white/5 bg-black/25 text-slate-200 hover:border-white/10 hover:bg-black/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-3xl font-bold">{card.count}</div>
                  </div>
                  <div className="mt-3 font-semibold">{card.label}</div>
                  <p className="mt-1 text-sm text-slate-400">{card.helper}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Groups</h3>
            <button
              type="button"
              onClick={() => setSelectedGroupId(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedGroupId
                  ? 'bg-white/8 text-slate-200 hover:bg-white/12'
                  : 'bg-white/5 text-slate-500'
              }`}
            >
              {selectedGroupId ? 'Clear group filter' : 'All groups'}
            </button>
          </div>
          {groupStats.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
              Create your first group to start assigning people.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {groupStats.map((group) => {
                const total = Math.max(group.total, 1)
                const memberPct = Math.round((group.members / total) * 100)
                const adminPct = Math.round((group.admins / total) * 100)
                const active = selectedGroupId === group.id
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedGroupId((current) => (current === group.id ? null : group.id))}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? 'border-red-500/30 bg-red-500/10'
                        : 'border-white/5 bg-black/25 hover:border-white/10 hover:bg-black/35'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-white">{group.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                          {group.slug}
                        </div>
                        {group.is_test && (
                          <div className="mt-2 inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-200">
                            Test
                          </div>
                        )}
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/20 text-slate-300">
                        <Building2 className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-white/6 px-2.5 py-1 text-slate-200">
                        {group.members} members
                      </span>
                      <span className="rounded-full bg-white/6 px-2.5 py-1 text-slate-200">
                        {group.admins} admins
                      </span>
                      {group.admins === 0 && (
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300">
                          No admin yet
                        </span>
                      )}
                    </div>

                    <div className="mt-4 overflow-hidden rounded-full bg-black/30">
                      <div className="flex h-2">
                        <div
                          className="bg-slate-300/70"
                          style={{ width: `${memberPct}%` }}
                        />
                        <div
                          className="bg-red-500/70"
                          style={{ width: `${adminPct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-black/20 p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">People & access</h3>
              <p className="mt-1 text-sm text-slate-400">
                Edit one person at a time with the most urgent accounts shown first.
              </p>
            </div>
            <div className="w-full lg:max-w-sm">
              <label className="mb-2 block text-sm font-medium text-slate-400">Search</label>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find by name or email"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filterCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveFilter(card.id)}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                  activeFilter === card.id
                    ? 'bg-red-600 text-white'
                    : 'bg-white/6 text-slate-300 hover:bg-white/10'
                }`}
              >
                {card.label} · {card.count}
              </button>
            ))}
            {activeGroup && (
              <span className="rounded-full bg-white/8 px-3 py-2 text-sm font-semibold text-slate-200">
                Group: {activeGroup.name}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{filteredProfiles.length}</span> people
            </div>
            {activeFilter !== 'test' && hiddenTestProfileCount > 0 && (
              <div className="text-slate-500">Test accounts stay out of this queue.</div>
            )}
            {activeFilter === 'needs-assignment' && filteredProfiles.length === 0 && needsAssignmentCount === 0 && (
              <div className="text-emerald-300">Everyone is already in Main Group or a private group.</div>
            )}
          </div>

          <div className="space-y-3">
            <div className="hidden md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(12rem,1.05fr)_minmax(10rem,0.8fr)_auto] md:items-center md:gap-3 md:px-2">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Person
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Current access
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Status
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 md:text-right">
                Action
              </div>
            </div>
            {filteredProfiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-slate-400">
                No people match this filter right now.
              </div>
            ) : (
              filteredProfiles.map((entry) => (
                <ManageAccessForm
                  key={`${entry.id}:${entry.role}:${entry.admin_scope || 'none'}:${entry.tenant_id || 'unassigned'}`}
                  profile={entry}
                  tenants={tenants}
                  currentUserId={currentUserId}
                  testModeAvailable={testModeAvailable}
                  expanded={openProfileId === entry.id}
                  onToggle={() =>
                    setOpenProfileId((current) => (current === entry.id ? null : entry.id))
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
