import { RaceStartLights } from '@/components/ui/race-start-lights'

export default function Loading() {
  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
        <div className="race-shell overflow-hidden rounded-3xl border border-white/10 bg-card p-6 pt-12 shadow-2xl md:p-8">
        <div className="race-loading-lights">
            <RaceStartLights variant="loading" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="race-skeleton-block h-7 w-28 rounded-full" />
            <div className="race-skeleton-block h-7 w-40 rounded-full" />
          </div>
          <div className="race-skeleton-block mt-6 h-4 w-24 rounded-full" />
          <div className="race-skeleton-block mt-3 h-12 w-3/4 rounded-2xl" />
          <div className="race-skeleton-block mt-3 h-5 w-2/3 rounded-xl" />

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
            <div className="race-skeleton-block h-5 w-24 rounded-full" />
            <div className="race-skeleton-block mt-4 h-10 w-2/3 rounded-2xl" />
            <div className="race-skeleton-block mt-3 h-4 w-1/2 rounded-xl" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
              <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
              <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
            </div>
            <div className="race-skeleton-block mt-5 h-12 w-44 rounded-xl" />
          </div>
        </div>

        <aside className="race-shell rounded-3xl border border-white/10 bg-card p-5 pt-12 shadow-2xl">
          <div className="race-loading-lights">
            <RaceStartLights variant="loading" />
          </div>
          <div className="race-skeleton-block h-4 w-28 rounded-full" />
          <div className="race-skeleton-block mt-3 h-8 w-3/5 rounded-xl" />
          <div className="race-skeleton-block mt-3 h-4 w-4/5 rounded-xl" />
          <div className="mt-5 space-y-3">
            <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
            <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
            <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
            <div className="race-skeleton-block h-20 rounded-2xl bg-black/30" />
          </div>
        </aside>
      </section>

      <section className="race-shell rounded-3xl border border-white/10 bg-card p-6 pt-12 shadow-xl">
        <div className="race-loading-lights">
          <RaceStartLights variant="loading" />
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-3">
            <div className="race-skeleton-block h-4 w-24 rounded-full" />
            <div className="race-skeleton-block h-8 w-52 rounded-xl" />
            <div className="race-skeleton-block h-4 w-72 rounded-xl" />
          </div>
          <div className="race-skeleton-block h-9 w-24 rounded-full" />
        </div>

        <div className="mt-6 space-y-4">
          <div className="race-skeleton-block h-32 rounded-3xl bg-black/30" />
          <div className="race-skeleton-block h-32 rounded-3xl bg-black/30" />
          <div className="race-skeleton-block h-32 rounded-3xl bg-black/30" />
        </div>
      </section>
    </div>
  )
}
