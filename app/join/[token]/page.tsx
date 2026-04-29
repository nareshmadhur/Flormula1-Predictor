import type { Metadata } from 'next'
import { AlertTriangle, CheckCircle2, LockKeyhole, Trophy, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getInviteClaimPath, hashInviteToken } from '@/utils/group-invites'
import { PendingLink } from '@/components/ui/pending-link'
import { JoinInviteForm } from './join-invite-form'

export const revalidate = 0

export const metadata: Metadata = {
  title: 'Join Group',
  description: 'Join a Flormula1 private group from an invite link.',
}

type PageProps = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string | string[] | undefined }>
}

type InvitePreview = {
  invite_id: string
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  expires_at: string
  max_uses: number
  accepted_count: number
  revoked_at?: string | null
  status: 'active' | 'expired' | 'revoked' | 'full'
}

type ProfilePreview = {
  tenant_id?: string | null
  role?: 'user' | 'admin' | null
  admin_scope?: 'platform' | 'tenant' | null
}

function getStatusCopy(status?: InvitePreview['status']) {
  if (status === 'expired') return 'This invite has expired.'
  if (status === 'revoked') return 'This invite has been closed.'
  if (status === 'full') return 'This invite has reached its join limit.'
  return 'This invite link is not available.'
}

function getNextAuthPath(basePath: '/login' | '/signup', token: string) {
  return `${basePath}?next=${encodeURIComponent(getInviteClaimPath(token))}`
}

export default async function JoinGroupPage({ params, searchParams }: PageProps) {
  const { token } = await params
  const query = await searchParams
  const claimError = Array.isArray(query.error) ? query.error[0] : query.error
  const cleanToken = String(token ?? '').trim()
  const supabase = await createClient()
  const inviteHash = cleanToken ? hashInviteToken(cleanToken) : ''

  const { data: inviteRows, error: inviteError } = inviteHash
    ? await supabase.rpc('get_group_invite_by_token', {
        invite_token_hash: inviteHash,
      })
    : { data: null, error: null }

  const invite = Array.isArray(inviteRows) ? (inviteRows[0] as InvitePreview | undefined) : undefined
  const inviteSetupUnavailable = Boolean(inviteError)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: ProfilePreview | null = null
  let currentGroupName: string | null = null

  if (user) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('tenant_id, role, admin_scope')
      .eq('id', user.id)
      .maybeSingle()

    profile = (profileRow as ProfilePreview | null) ?? null

    if (profile?.tenant_id) {
      const { data: currentGroup } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', profile.tenant_id)
        .maybeSingle()

      currentGroupName = currentGroup?.name ?? null
    }
  }

  const isInviteActive = invite?.status === 'active'
  const alreadyInGroup = Boolean(invite && profile?.tenant_id === invite.tenant_id)
  const groupAdminConflict = Boolean(
    invite &&
      profile?.role === 'admin' &&
      profile.admin_scope === 'tenant' &&
      profile.tenant_id &&
      profile.tenant_id !== invite.tenant_id
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-500">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-card shadow-2xl">
        <div className="border-b border-white/10 bg-gradient-to-br from-red-500/15 via-slate-900 to-black p-6 sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-200">
            <Users className="h-3.5 w-3.5 text-red-300" />
            Group Invite
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white">
            {invite?.tenant_name ? `Join ${invite.tenant_name}` : 'Join a Flormula1 group'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Private groups let you compare picks, standings, and race-weekend bragging rights with the people
            you actually know.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {claimError && (
            <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
              {claimError}
            </div>
          )}

          {inviteSetupUnavailable ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-100">
              Invites are not ready yet. Ask support to finish group invite setup.
            </div>
          ) : !invite || !isInviteActive ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-300" />
                  <div className="font-bold text-red-100">{getStatusCopy(invite?.status)}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-red-100/80">
                  Ask the group organizer for a fresh invite link.
                </p>
              </div>
              <PendingLink
                href="/leaderboard"
                className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
              >
                View public standings
              </PendingLink>
            </div>
          ) : !user ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
                  <Trophy className="h-5 w-5 text-red-300" />
                  <div className="mt-3 text-sm font-bold text-white">Group standings</div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Follow the private leaderboard.</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
                  <LockKeyhole className="h-5 w-5 text-red-300" />
                  <div className="mt-3 text-sm font-bold text-white">Signed-in picks</div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Save your race picks to your account.</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
                  <CheckCircle2 className="h-5 w-5 text-red-300" />
                  <div className="mt-3 text-sm font-bold text-white">Instant access</div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Auto-join after email confirmation.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <PendingLink
                  href={getNextAuthPath('/signup', cleanToken)}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
                >
                  Create account
                </PendingLink>
                <PendingLink
                  href={getNextAuthPath('/login', cleanToken)}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
                >
                  Sign in
                </PendingLink>
              </div>
            </div>
          ) : alreadyInGroup ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-300" />
                  <div className="font-bold text-green-100">You are already in {invite.tenant_name}.</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-green-100/80">
                  Head to standings to see where the group battle stands.
                </p>
              </div>
              <PendingLink
                href="/leaderboard?view=tenant"
                className="inline-flex items-center rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
              >
                Open group standings
              </PendingLink>
            </div>
          ) : groupAdminConflict ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
              Your account manages another group, so this invite cannot move it automatically. Ask a platform
              admin to move the account if this change is intentional.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Ready to join</div>
                <div className="mt-2 text-2xl font-black italic text-white">{invite.tenant_name}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Click once to add this account to the group and open the group standings.
                </p>
              </div>

              <JoinInviteForm
                token={cleanToken}
                groupName={invite.tenant_name}
                currentGroupName={currentGroupName}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
