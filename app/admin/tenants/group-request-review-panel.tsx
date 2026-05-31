'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNowStrict } from 'date-fns'
import { CheckCircle2, Clock3, UsersRound } from 'lucide-react'
import { approveGroupRequest, rejectGroupRequest } from '@/app/actions/group-requests'
import { FormActionButton } from '@/components/ui/form-action-button'
import { getProfileDisplayName } from '@/utils/profile-name'
import {
  initialGroupRequestActionState,
  type GroupRequestActionState,
} from '@/app/groups/request/action-state'

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

type Profile = {
  id: string
  display_name?: string | null
  email?: string | null
  tenant_id?: string | null
}

type Tenant = {
  id: string
  name: string
  slug: string
}

type GroupRequestReviewPanelProps = {
  requests: GroupRequest[]
  profiles: Profile[]
  tenants: Tenant[]
  setupMessage?: string | null
}

function getSlugSuggestion(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

function ActionMessage({ state }: { state: GroupRequestActionState }) {
  if (!state.message) return null

  return (
    <div
      className={`rounded-xl border px-3 py-2 text-xs leading-5 ${
        state.status === 'success'
          ? 'border-green-500/20 bg-green-500/10 text-green-200'
          : 'border-red-500/20 bg-red-500/10 text-red-300'
      }`}
    >
      {state.message}
    </div>
  )
}

function ApproveRequestForm({ request }: { request: GroupRequest }) {
  const router = useRouter()
  const [state, formAction] = useActionState<GroupRequestActionState, FormData>(
    approveGroupRequest,
    initialGroupRequestActionState
  )

  useEffect(() => {
    if (state.status === 'success') router.refresh()
  }, [router, state.status])

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-green-500/15 bg-green-500/5 p-4">
      <input type="hidden" name="request_id" value={request.id} />
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-green-100/70">Slug</span>
        <input
          name="slug"
          required
          minLength={3}
          maxLength={60}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          defaultValue={getSlugSuggestion(request.requested_name)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"
        />
      </label>
      <p className="text-xs leading-5 text-green-100/70">
        Approval creates the group, moves the requester into it, and makes them group admin.
      </p>
      <FormActionButton idleLabel="Approve and create group" pendingLabel="Creating group..." />
      <ActionMessage state={state} />
    </form>
  )
}

function RejectRequestForm({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [state, formAction] = useActionState<GroupRequestActionState, FormData>(
    rejectGroupRequest,
    initialGroupRequestActionState
  )

  useEffect(() => {
    if (state.status === 'success') router.refresh()
  }, [router, state.status])

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
      <input type="hidden" name="request_id" value={requestId} />
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Note to requester</span>
        <textarea
          name="review_note"
          required
          minLength={3}
          maxLength={500}
          rows={3}
          placeholder="Explain what needs to change before they submit again."
          className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"
        />
      </label>
      <FormActionButton idleLabel="Close request with note" pendingLabel="Closing request..." tone="secondary" />
      <ActionMessage state={state} />
    </form>
  )
}

export function GroupRequestReviewPanel({
  requests,
  profiles,
  tenants,
  setupMessage,
}: GroupRequestReviewPanelProps) {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]))

  return (
    <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-xl md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-red-200">
            <UsersRound className="h-4 w-4" />
            Group requests
          </div>
          <h2 className="mt-3 text-2xl font-black italic tracking-tight text-white">Organizer approval queue</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Approve the organizer only. Everyone else moves later by accepting an invite link from the new group admin.
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/25 px-4 py-3 text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending</div>
          <div className="mt-1 text-3xl font-black italic text-white">{requests.length}</div>
        </div>
      </div>

      {setupMessage ? (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {setupMessage}
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-slate-400">
          No private-group requests are waiting for review.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {requests.map((request) => {
            const requester = profilesById.get(request.requested_by)
            const sourceTenant = request.source_tenant_id ? tenantsById.get(request.source_tenant_id) : null
            const currentTenant = requester?.tenant_id ? tenantsById.get(requester.tenant_id) : null

            return (
              <article key={request.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-200">
                        <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                        Waiting
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNowStrict(new Date(request.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <h3 className="mt-3 text-2xl font-black italic tracking-tight text-white">{request.requested_name}</h3>
                    <div className="mt-2 text-sm text-slate-300">
                      Requested by {getProfileDisplayName(requester?.display_name, requester?.email, 'Unknown account')}
                      {requester?.email ? ` · ${requester.email}` : ''}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      Expected players: {request.expected_player_count} · Current group: {currentTenant?.name || 'Unassigned'}
                    </div>
                    {sourceTenant?.id !== currentTenant?.id && (
                      <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                        This account was in {sourceTenant?.name || 'an unassigned state'} when the request was submitted
                        and is now in {currentTenant?.name || 'an unassigned state'}.
                      </div>
                    )}
                    {request.description && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{request.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-xs leading-5 text-green-200">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Requester confirmed the move and group-admin promotion.
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <ApproveRequestForm request={request} />
                  <RejectRequestForm requestId={request.id} />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
