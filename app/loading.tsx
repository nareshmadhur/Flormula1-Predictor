export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-card p-8 shadow-2xl">
        <div className="h-4 w-28 rounded-full bg-white/10" />
        <div className="mt-5 h-12 w-3/4 rounded-2xl bg-white/10" />
        <div className="mt-3 h-5 w-2/3 rounded-xl bg-white/10" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="h-28 rounded-2xl border border-white/5 bg-black/30" />
          <div className="h-28 rounded-2xl border border-white/5 bg-black/30" />
          <div className="h-28 rounded-2xl border border-white/5 bg-black/30" />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-card p-6 shadow-xl">
          <div className="h-6 w-40 rounded-xl bg-white/10" />
          <div className="mt-5 space-y-3">
            <div className="h-16 rounded-2xl bg-black/30" />
            <div className="h-16 rounded-2xl bg-black/30" />
            <div className="h-16 rounded-2xl bg-black/30" />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card p-6 shadow-xl">
          <div className="h-6 w-44 rounded-xl bg-white/10" />
          <div className="mt-5 space-y-3">
            <div className="h-24 rounded-2xl bg-black/30" />
            <div className="h-24 rounded-2xl bg-black/30" />
          </div>
        </div>
      </section>
    </div>
  )
}
