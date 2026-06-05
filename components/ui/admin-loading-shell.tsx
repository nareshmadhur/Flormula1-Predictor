import { RaceStartLights } from '@/components/ui/race-start-lights'

type AdminLoadingShellProps = {
  title?: string
  description?: string
}

export function AdminLoadingShell({
  title = 'Loading admin',
  description = 'Preparing the workspace.',
}: AdminLoadingShellProps) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <section className="race-shell overflow-hidden rounded-3xl border border-white/10 bg-card p-5 pt-12 shadow-2xl sm:p-6">
        <div className="race-loading-lights">
          <RaceStartLights variant="loading" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          <span>{title}</span>
        </div>
        <div className="mt-3 race-skeleton-block h-9 w-64 max-w-full rounded-2xl" />
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">{description}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="race-skeleton-block h-24 rounded-2xl bg-black/30" />
          <div className="race-skeleton-block h-24 rounded-2xl bg-black/30" />
          <div className="race-skeleton-block h-24 rounded-2xl bg-black/30" />
        </div>
      </section>

      <section className="race-shell rounded-3xl border border-white/10 bg-card p-5 pt-12 shadow-xl sm:p-6">
        <div className="race-loading-lights">
          <RaceStartLights variant="loading" />
        </div>
        <div className="race-skeleton-block h-5 w-32 rounded-full" />
        <div className="mt-5 space-y-3">
          <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
          <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
          <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
        </div>
      </section>
    </div>
  )
}
