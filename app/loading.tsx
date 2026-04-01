export default function Loading() {
  return (
    <div className="space-y-8">
      <section className="race-shell overflow-hidden rounded-3xl border border-white/10 bg-card p-8 pt-12 shadow-2xl">
        <div className="race-skeleton-block h-4 w-28 rounded-full" />
        <div className="race-skeleton-block mt-5 h-12 w-3/4 rounded-2xl" />
        <div className="race-skeleton-block mt-3 h-5 w-2/3 rounded-xl" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="race-skeleton-block h-28 rounded-2xl border border-white/5 bg-black/30" />
          <div className="race-skeleton-block h-28 rounded-2xl border border-white/5 bg-black/30" />
          <div className="race-skeleton-block h-28 rounded-2xl border border-white/5 bg-black/30" />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="race-shell rounded-3xl border border-white/10 bg-card p-6 pt-12 shadow-xl">
          <div className="race-skeleton-block h-6 w-40 rounded-xl" />
          <div className="mt-5 space-y-3">
            <div className="race-skeleton-block h-16 rounded-2xl bg-black/30" />
            <div className="race-skeleton-block h-16 rounded-2xl bg-black/30" />
            <div className="race-skeleton-block h-16 rounded-2xl bg-black/30" />
          </div>
        </div>

        <div className="race-shell rounded-3xl border border-white/10 bg-card p-6 pt-12 shadow-xl">
          <div className="race-skeleton-block h-6 w-44 rounded-xl" />
          <div className="mt-5 space-y-3">
            <div className="race-skeleton-block h-24 rounded-2xl bg-black/30" />
            <div className="race-skeleton-block h-24 rounded-2xl bg-black/30" />
          </div>
        </div>
      </section>
    </div>
  )
}
