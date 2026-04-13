'use client'

import { useActionState, useMemo, useState } from 'react'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { Copy, Link2, ShieldOff, Users } from 'lucide-react'
import { createCopyableGroupInvite, createGroupInvite, revokeGroupInvite } from '@/app/actions/group-invites'
import { FormActionButton } from '@/components/ui/form-action-button'
import {
  initialGroupInviteActionState,
  type GroupInviteActionState,
} from '@/app/admin/tenant/invite-action-state'

type GroupInvite = {
  id: string
  invite_url?: string | null
  expires_at: string
  max_uses: number
  accepted_count: number
  revoked_at?: string | null
  last_accepted_at?: string | null
  created_at: string
}

type GroupInvitePanelProps = {
  groupName: string
  invites: GroupInvite[]
  setupMessage?: string | null
  migrationNotice?: string | null
}

function getInviteStatus(invite: GroupInvite) {
  if (invite.revoked_at) {
    return {
      label: 'Revoked',
      tone: 'border-slate-600/30 bg-slate-700/30 text-slate-300',
    }
  }

  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return {
      label: 'Expired',
      tone: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
    }
  }

  if (invite.accepted_count >= invite.max_uses) {
    return {
      label: 'Full',
      tone: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
    }
  }

  return {
    label: 'Active',
    tone: 'border-green-500/25 bg-green-500/10 text-green-200',
  }
}

function CopyInviteButton({ inviteUrl, className }: { inviteUrl: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copyInvite}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/8 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/12 ${className || ''}`.trim()}
    >
      <Copy className="h-4 w-4" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function RevokeInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction] = useActionState<GroupInviteActionState, FormData>(
    revokeGroupInvite,
    initialGroupInviteActionState
  )

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="invite_id" value={inviteId} />
      <FormActionButton
        idleLabel="Revoke"
        pendingLabel="Revoking..."
        tone="secondary"
        className="py-2 text-sm"
      />
      {state.status === 'error' && state.message && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {state.message}
        </p>
      )}
    </form>
  )
}

function CreateCopyableInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction] = useActionState<GroupInviteActionState, FormData>(
    createCopyableGroupInvite,
    initialGroupInviteActionState
  )

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="invite_id" value={inviteId} />
      <FormActionButton
        idleLabel="Create Copyable Link"
        pendingLabel="Creating..."
        tone="amber"
        className="py-2 text-sm"
      />
      {state.message && (
        <p
          className={`rounded-xl border px-3 py-2 text-xs leading-5 ${
            state.status === 'success'
              ? 'border-green-500/20 bg-green-500/10 text-green-200'
              : 'border-red-500/20 bg-red-500/10 text-red-300'
          }`}
        >
          {state.message}
        </p>
      )}
      {state.inviteUrl && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={state.inviteUrl}
            readOnly
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200"
          />
          <CopyInviteButton inviteUrl={state.inviteUrl} />
        </div>
      )}
    </form>
  )
}

export function GroupInvitePanel({ groupName, invites, setupMessage, migrationNotice }: GroupInvitePanelProps) {
  const [state, formAction] = useActionState<GroupInviteActionState, FormData>(
    createGroupInvite,
    initialGroupInviteActionState
  )
  const activeInviteCount = useMemo(
    () => invites.filter((invite) => getInviteStatus(invite).label === 'Active').length,
    [invites]
  )

  return (
    <section id="group-invites" className="scroll-mt-28 rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-red-200">
            <Link2 className="h-3.5 w-3.5" />
            Group Invites
          </div>
          <h2 className="text-2xl font-black italic tracking-tighter text-white">Share {groupName}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Create a link, send it to the people you want in this group, and they can join after signing in.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-64">
          <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Active</div>
            <div className="mt-2 text-3xl font-black italic text-white">{activeInviteCount}</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Joined</div>
            <div className="mt-2 text-3xl font-black italic text-white">
              {invites.reduce((total, invite) => total + invite.accepted_count, 0)}
            </div>
          </div>
        </div>
      </div>

      {migrationNotice && (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {migrationNotice}
        </div>
      )}

      {setupMessage ? (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-200">
          {setupMessage}
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <form action={formAction} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Expires
                  </span>
                  <select
                    name="expires_in_days"
                    defaultValue="14"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white"
                  >
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Join limit
                  </span>
                  <input
                    name="max_uses"
                    type="number"
                    min="1"
                    max="500"
                    defaultValue="50"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white"
                  />
                </label>
              </div>

              <FormActionButton idleLabel="Create Invite Link" pendingLabel="Creating..." />
            </form>

            {state.message && (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  state.status === 'success'
                    ? 'border-green-500/20 bg-green-500/10 text-green-200'
                    : 'border-red-500/20 bg-red-500/10 text-red-300'
                }`}
              >
                {state.message}
              </div>
            )}

            {state.inviteUrl && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  New share link
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={state.inviteUrl}
                    readOnly
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200"
                  />
                  <CopyInviteButton inviteUrl={state.inviteUrl} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {invites.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-slate-400">
                No invite links yet. Create one when you are ready to bring people in.
              </div>
            ) : (
              invites.map((invite) => {
                const status = getInviteStatus(invite)
                const canRevoke = status.label === 'Active'

                return (
                  <div key={invite.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${status.tone}`}>
                            {status.label}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 text-xs font-semibold text-slate-300">
                            <Users className="h-3.5 w-3.5" />
                            {invite.accepted_count}/{invite.max_uses} joined
                          </span>
                        </div>
                        <div className="mt-3 text-sm text-slate-300">
                          Expires {format(new Date(invite.expires_at), 'MMM d, yyyy HH:mm')}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Created {formatDistanceToNowStrict(new Date(invite.created_at), { addSuffix: true })}
                          {invite.last_accepted_at
                            ? ` · Last joined ${formatDistanceToNowStrict(new Date(invite.last_accepted_at), { addSuffix: true })}`
                            : ''}
                        </div>
                        {canRevoke && invite.invite_url && (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                              Share link
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                value={invite.invite_url}
                                readOnly
                                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200"
                              />
                              <CopyInviteButton inviteUrl={invite.invite_url} />
                            </div>
                          </div>
                        )}
                        {canRevoke && !invite.invite_url && (
                          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-amber-200">
                              Older active link
                            </div>
                            <p className="mt-1 text-xs leading-5 text-amber-100/80">
                              It still works if someone already has it. Create a copyable link if you need to share again.
                            </p>
                            <CreateCopyableInviteForm inviteId={invite.id} />
                          </div>
                        )}
                      </div>

                      {canRevoke ? (
                        <div className="sm:min-w-32">
                          <RevokeInviteForm inviteId={invite.id} />
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-500">
                          <ShieldOff className="h-4 w-4" />
                          Closed
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </section>
  )
}
