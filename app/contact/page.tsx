import type { Metadata } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { getAbsoluteUrl } from '@/utils/site'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact information for Flormula1.',
  alternates: {
    canonical: getAbsoluteUrl('/contact'),
  },
}

export default function ContactPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="rounded-[2rem] border border-white/10 bg-card p-6 shadow-2xl sm:p-8">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-red-400">
          Support
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">Contact</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Email Naresh for group setup, account questions, race-data corrections, or partnership conversations.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="mailto:nareshmadhur@gmail.com?subject=Flormula1%20support"
            className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/12 px-4 py-2 text-sm font-medium text-red-50 transition-colors hover:bg-red-500/18"
          >
            Email support
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <a
            href="https://nareshmadhur.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
          >
            About Naresh
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Group setup</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Questions about creating a group, inviting people, or getting everyone into the right pool.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Race corrections</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Tell us if a race time, result, or score looks wrong.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-lg font-bold text-white">Partnerships</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Interested in running an office or friend-group league on Flormula1? Reach out and we can help.
          </p>
        </div>
      </section>
    </div>
  )
}
