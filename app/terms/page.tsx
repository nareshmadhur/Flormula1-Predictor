import type { Metadata } from 'next'
import { getAbsoluteUrl } from '@/utils/site'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms and fair-use notes for Flormula1.',
  alternates: {
    canonical: getAbsoluteUrl('/terms'),
  },
}

export default function TermsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="rounded-[2rem] border border-white/10 bg-card p-6 shadow-2xl sm:p-8">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-red-400">
          Ground rules
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">Terms</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Simple ground rules for using Flormula1 fairly and understanding what the product is.
        </p>
      </div>

      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Independent game</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Flormula1 is independent and unofficial. It is not affiliated with Formula 1, Formula One
            Licensing, FIA, racing teams, drivers, or official race organizers.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Not a betting platform</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Flormula1 is built for friendly private prediction groups. It does not run betting, wagering,
            or prize-pool contests.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Race data and scoring</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Race times and results can change. When they do, standings may be corrected so every group keeps
            a fair and accurate season record.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Fair use</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Users should not abuse invites, automate submissions, impersonate others, or interfere with
            group scoring. Flormula1 may correct data or access when needed to keep the game fair.
          </p>
        </div>
      </section>
      <p className="text-xs leading-5 text-slate-500">
        Questions about fair use or group setup can be sent through the contact link in the footer.
      </p>
    </div>
  )
}
