import Link from 'next/link'

type TenantAssignmentRequiredProps = {
  isAdmin?: boolean
}

export function TenantAssignmentRequired({ isAdmin = false }: TenantAssignmentRequiredProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-8 text-center shadow-2xl">
      <div className="space-y-2">
        <div className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">Tenant Required</div>
        <h1 className="text-3xl font-black italic tracking-tighter text-white">ASSIGN THIS ACCOUNT TO A TENANT</h1>
        <p className="text-slate-300">
          Competition pages are now tenant-scoped. This account needs a tenant assignment before predictions,
          history, and tenant leaderboard views can open.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
        >
          Return Home
        </Link>
        {isAdmin ? (
          <Link
            href="/admin/tenants"
            className="inline-flex items-center rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
          >
            Open Tenant Setup
          </Link>
        ) : (
          <Link
            href="/leaderboard"
            className="inline-flex items-center rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
          >
            View Public Leaderboard
          </Link>
        )}
      </div>
    </div>
  )
}
