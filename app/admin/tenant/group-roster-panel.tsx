'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Crown, ShieldCheck, UserCheck, Users } from 'lucide-react'
import { updateGroupMemberAccess } from '@/app/actions/group-admin'
import { FormActionButton } from '@/components/ui/form-action-button'
import { getProfileDisplayName } from '@/utils/profile-name'
import {
  initialGroupMemberActionState,
  type GroupMemberActionState,
} from './member-action-state'

type GroupRosterMember = {
  id: string
  display_name?: string | null
  email?: string | null
  role: 'user' | 'admin'
  admin_scope?: 'platform' | 'tenant' | null
  tenant_id?: string | null
  is_test?: boolean | null
}

type GroupRosterStanding = {
  total_points: number
  exact_hits: number
  races_scored: number
}

export type GroupRosterEntry = {
  member: GroupRosterMember
  standing?: GroupRosterStanding | null
  featuredRaceStatus: string
}

type GroupRosterPanelProps = {
  roster: GroupRosterEntry[]
  currentUserId: string
  isMainGroup: boolean
  tenantAdminCount: number
}

type MemberAction = 'promote' | 'demote' | 'move_to_main'

function getAccessLabel(member: GroupRosterMember) {
  if (member.role !== 'admin') return 'Member'
  if (member.admin_scope === 'platform') return 'Platform admin'
  return 'Group admin'
}

function getAccessIcon(member: GroupRosterMember) {
  if (member.role !== 'admin') return <Users className="h-4 w-4 text-slate-400" />
  if (member.admin_scope === 'platform') return <ShieldCheck className="h-4 w-4 text-slate-300" />
  return <Crown className="h-4 w-4 text-red-400" />
}

function getFeaturedRaceStatusClasses(status: string) {
  if (status === 'Entered' || status === 'Locked in' || status === 'Scored') {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
  }

  if (status === 'Needs entry') {
    return 'border-amber-500/20 bg-amber-500/10 text-amber-200'
  }

  if (status.includes('Missed')) {
    return 'border-red-500/20 bg-red-500/10 text-red-200'
  }

  return 'border-white/10 bg-white/5 text-slate-300'
}

function MemberActionForm({
  profileId,
  action,
  idleLabel,
  pendingLabel,
  disabled,
}: {
  profileId: string
  action: MemberAction
  idleLabel: string
  pendingLabel: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [state, formAction] = useActionState<GroupMemberActionState, FormData>(
    updateGroupMemberAccess,
    initialGroupMemberActionState
  )

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh()
    }
  }, [router, state.status])

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="member_action" value={action} />
      <FormActionButton
        idleLabel={idleLabel}
        pendingLabel={pendingLabel}
        tone="secondary"
        disabled={disabled}
        className="py-2 text-xs"
      />
      {state.status !== 'idle' && state.message && (
        <p
          className={`rounded-xl border px-3 py-2 text-xs leading-5 ${
            state.status === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/20 bg-red-500/10 text-red-200'
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

export function GroupRosterPanel({
  roster,
  currentUserId,
  isMainGroup,
  tenantAdminCount,
}: GroupRosterPanelProps) {
  const sortedRoster = [...roster].sort((left, right) => {
    const leftAdminRank = left.member.role === 'admin' ? 0 : 1
    const rightAdminRank = right.member.role === 'admin' ? 0 : 1
    if (leftAdminRank !== rightAdminRank) return leftAdminRank - rightAdminRank

    return getProfileDisplayName(left.member.display_name, left.member.email).localeCompare(
      getProfileDisplayName(right.member.display_name, right.member.email)
    )
  })

  return (
    <details id="group-roster" className="group scroll-mt-28 rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
              <UserCheck className="h-3.5 w-3.5 text-red-400" />
              Roster
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
              {roster.length} members
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
              {tenantAdminCount} admins
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">Group members and access</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Promote trusted members, move people back to Main Group, and check race entries in one place.
          </p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
      </summary>

      {sortedRoster.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-slate-400">
          No members are assigned to this group yet.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/5 text-sm text-slate-400">
                <th className="p-4 font-bold">Member</th>
                <th className="p-4 font-bold">Access</th>
                <th className="p-4 font-bold text-right">Points</th>
                <th className="p-4 font-bold text-right">Featured Race</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedRoster.map(({ member, standing, featuredRaceStatus }) => {
                const isSelf = member.id === currentUserId
                const isGroupAdmin = member.role === 'admin' && member.admin_scope === 'tenant'
                const isPlatformAdmin = member.role === 'admin' && member.admin_scope === 'platform'
                const protectsLastAdmin = isGroupAdmin && tenantAdminCount <= 1
                const actionsDisabled = isSelf || isPlatformAdmin
                const demoteDisabled = actionsDisabled || protectsLastAdmin
                const moveDisabled = actionsDisabled || protectsLastAdmin || isMainGroup

                return (
                  <tr key={member.id} className="align-top transition-colors hover:bg-white/[0.02]">
                    <td className="p-4">
                      <div className="font-semibold text-slate-100">
                        {getProfileDisplayName(member.display_name, member.email)}
                        {member.is_test && (
                          <span className="ml-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                            Test
                          </span>
                        )}
                      </div>
                      <div className="break-all text-sm text-slate-500">{member.email || 'No email'}</div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-slate-200">
                        {getAccessIcon(member)}
                        {getAccessLabel(member)}
                      </div>
                      {(isSelf || isPlatformAdmin || protectsLastAdmin) && (
                        <div className="mt-2 text-xs leading-5 text-slate-500">
                          {isSelf
                            ? 'Current account'
                            : isPlatformAdmin
                              ? 'Platform access is managed globally'
                              : 'Last group admin'}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="text-xl font-bold text-red-500">{standing?.total_points ?? 0}</div>
                      <div className="text-xs text-slate-500">
                        {standing?.exact_hits ?? 0} exact · {standing?.races_scored ?? 0} races
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${getFeaturedRaceStatusClasses(featuredRaceStatus)}`}>
                        {featuredRaceStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="ml-auto grid max-w-52 gap-2">
                        {isGroupAdmin ? (
                          <MemberActionForm
                            profileId={member.id}
                            action="demote"
                            idleLabel="Make member"
                            pendingLabel="Saving..."
                            disabled={demoteDisabled}
                          />
                        ) : (
                          <MemberActionForm
                            profileId={member.id}
                            action="promote"
                            idleLabel="Make admin"
                            pendingLabel="Saving..."
                            disabled={actionsDisabled}
                          />
                        )}
                        {!isMainGroup && (
                          <MemberActionForm
                            profileId={member.id}
                            action="move_to_main"
                            idleLabel="Move to Main"
                            pendingLabel="Moving..."
                            disabled={moveDisabled}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}
