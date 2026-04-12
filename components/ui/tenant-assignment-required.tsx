import { PendingLink } from '@/components/ui/pending-link'

type TenantAssignmentRequiredProps = {
  isAdmin?: boolean
}

export function TenantAssignmentRequired({ isAdmin = false }: TenantAssignmentRequiredProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-8 text-center shadow-2xl">
      <div className="space-y-2">
        <div className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">Group Needed</div>
        <h1 className="text-3xl font-black italic tracking-tighter text-white">JOIN A GROUP TO PLAY</h1>
        <p className="text-slate-300">
          Predictions, history, and private standings open once this account has been added to a group.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-left">
        <div className="text-sm font-bold uppercase tracking-widest text-slate-400">While you wait</div>
        <div className="mt-3 grid gap-3 text-sm text-slate-300">
          <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">
            Browse the public leaderboard and season story while your group access is being set up.
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">
            Set the display name you want other predictors to see on the leaderboard.
          </div>
          {isAdmin && (
            <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">
              Because your account can manage groups, you can also finish setup yourself.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <PendingLink
          href="/"
          className="inline-flex items-center rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
        >
          Return Home
        </PendingLink>
        <PendingLink
          href="/me/profile"
          className="inline-flex items-center rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
        >
          Open Profile
        </PendingLink>
        {isAdmin ? (
          <PendingLink
            href="/admin/tenants"
            className="inline-flex items-center rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
          >
            Open Group Setup
          </PendingLink>
        ) : (
          <PendingLink
            href="/leaderboard"
            className="inline-flex items-center rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
          >
            View Public Leaderboard
          </PendingLink>
        )}
      </div>
    </div>
  )
}
