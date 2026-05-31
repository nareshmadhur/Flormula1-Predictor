import type { Metadata } from 'next'
import { ArrowRight, CheckCircle2, Clock3, UsersRound } from 'lucide-react'
import { redirect } from 'next/navigation'
import { PendingLink } from '@/components/ui/pending-link'
import { PageBackLink } from '@/components/ui/page-back-link'
import { getAdminAccessContext } from '@/utils/admin-access'
import { createClient } from '@/utils/supabase/server'
import { getUserTenantContext } from '@/utils/tenant'
import { RequestGroupForm } from './request-group-form'

export const revalidate = 0

export const metadata: Metadata = {
  title: 'Request Private Group',
  description: 'Request a private Flormula1 group for your pool.',
}

type GroupRequest = {
  id: string
  requested_name: string
  description?: string | null
  expected_player_count: number
  status: 'pending' | 'approved' | 'rejected'
  review_note?: string | null
  created_at: string
}

export default async function RequestGroupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/groups/request')

  const [tenantContext, access, requestResult] = await Promise.all([
    getUserTenantContext(supabase, user.id),
    getAdminAccessContext(supabase),
    supabase
      .from('group_requests')
      .select('id, requested_name, description, expected_player_count, status, review_note, created_at')
      .eq('requested_by', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const latestRequest = ((requestResult.data || [])[0] as GroupRequest | undefined) ?? null
  const currentGroupName = tenantContext.tenantName || 'your current group'
  const requestSetupUnavailable = Boolean(requestResult.error)
  const canSubmit = tenantContext.role === 'user' && latestRequest?.status !== 'pending'

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-500">
      <PageBackLink href="/me/profile" label="Back to Profile" />

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl">
        <div className="border-b border-white/10 bg-gradient-to-br from-red-500/15 via-slate-900 to-black p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-red-200">
            <UsersRound className="h-4 w-4" />
            Private groups
          </div>
          <h1 className="mt-4 text-4xl font-black italic tracking-tighter text-white">Start your own pool</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Request a private group for friends, colleagues, or family. A platform admin reviews the request before
            anything changes.
          </p>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
              <div className="text-sm font-bold text-white">1. Request</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">Tell us what group you want to organize.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
              <div className="text-sm font-bold text-white">2. Approval</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">You move only after platform-admin approval.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
              <div className="text-sm font-bold text-white">3. Invite</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">Everyone else chooses whether to join your link.</p>
            </div>
          </div>

          {requestSetupUnavailable ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
              Private-group requests are not ready in this database yet. Ask support to finish the latest group update.
            </div>
          ) : latestRequest?.status === 'pending' ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex items-center gap-2 text-lg font-bold text-amber-100">
                <Clock3 className="h-5 w-5" />
                Request pending
              </div>
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                Your request for {latestRequest.requested_name} is waiting for review. Keep playing in {currentGroupName}{' '}
                until it is approved.
              </p>
            </div>
          ) : latestRequest?.status === 'approved' ? (
            <div className="space-y-4 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
              <div className="flex items-center gap-2 text-lg font-bold text-green-100">
                <CheckCircle2 className="h-5 w-5" />
                {latestRequest.requested_name} is ready
              </div>
              <p className="text-sm leading-6 text-green-100/80">
                Your account is now the group admin. Open group ops to create an invite link for everyone else.
              </p>
              <PendingLink
                href="/admin/tenant"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition-colors hover:bg-red-500"
              >
                Open group ops
                <ArrowRight className="h-4 w-4" />
              </PendingLink>
            </div>
          ) : access?.isPlatformAdmin ? (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="text-sm leading-6 text-slate-300">
                Platform admins can create groups directly and assign the organizer from group setup.
              </p>
              <PendingLink
                href="/admin/tenants"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition-colors hover:bg-red-500"
              >
                Open group setup
                <ArrowRight className="h-4 w-4" />
              </PendingLink>
            </div>
          ) : tenantContext.role !== 'user' ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
              Your account already manages a group. Ask a platform admin to handle a move so the current group is not
              left without a manager.
            </div>
          ) : (
            <>
              {latestRequest?.status === 'rejected' && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
                  <div className="font-bold">Your previous request needs another pass.</div>
                  <p className="mt-1">{latestRequest.review_note || 'Review the details and send a fresh request.'}</p>
                </div>
              )}

              {canSubmit && <RequestGroupForm currentGroupName={currentGroupName} />}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
