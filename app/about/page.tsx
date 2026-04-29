import type { Metadata } from 'next'
import { ArrowUpRight, HeartHandshake, ShieldCheck, UserRound } from 'lucide-react'
import { PendingLink } from '@/components/ui/pending-link'
import { getAbsoluteUrl } from '@/utils/site'

export const metadata: Metadata = {
  title: 'About',
  description: 'About Flormula1, the free Formula 1 fan scoreboard for private groups. No betting or cash play.',
  alternates: {
    canonical: getAbsoluteUrl('/about'),
  },
}

function ExternalCard({
  title,
  description,
  icon,
  href,
  cta,
}: {
  title: string
  description: string
  icon: string
  href: string
  cta: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5 shadow-xl">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-3 text-lg font-black tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
      >
        {cta}
        <ArrowUpRight className="h-4 w-4" />
      </a>
    </div>
  )
}

export default function AboutPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="rounded-[2rem] border border-white/10 bg-card p-6 shadow-2xl sm:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-300">
          <HeartHandshake className="h-3.5 w-3.5 text-red-400" />
          About Flormula1
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">A friendly fan scoreboard for race weekends</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Pick the podium before FP1, follow the official result, and track season standings with your group.
        </p>
        <p className="mt-3 max-w-3xl text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
          Free to play. No betting, no wagers, no cash prizes.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-2xl">🏁</div>
            <div className="mt-2 font-bold text-white">Predict</div>
            <p className="mt-1 text-sm text-slate-400">Pick the podium before FP1 lock.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-2xl">📊</div>
            <div className="mt-2 font-bold text-white">Compare</div>
            <p className="mt-1 text-sm text-slate-400">See transparent points and standings.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-2xl">👥</div>
            <div className="mt-2 font-bold text-white">Share</div>
            <p className="mt-1 text-sm text-slate-400">Run friendly private groups across a season.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <PendingLink
            href="/season"
            className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/12 px-4 py-2 text-sm font-medium text-red-50 transition-colors hover:bg-red-500/18"
          >
            Open season
          </PendingLink>
          <PendingLink
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
          >
            Open leaderboard
          </PendingLink>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
              <UserRound className="h-4 w-4 text-red-400" />
              Maintainer
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Naresh Madhur</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-white/6 px-3 py-1.5 text-slate-200">🤖 AI</span>
              <span className="rounded-full bg-white/6 px-3 py-1.5 text-slate-200">📈 Analytics</span>
              <span className="rounded-full bg-white/6 px-3 py-1.5 text-slate-200">🎸 Music</span>
              <span className="rounded-full bg-white/6 px-3 py-1.5 text-slate-200">📷 Photography</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Naresh builds Flormula1 around sport, analytics, creativity, and friendly group rivalry.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="https://nareshmadhur.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
              >
                NareshMadhur.com
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="https://github.com/nareshmadhur"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
              >
                GitHub
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="https://linkedin.com/in/naresh-madhur"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
              >
                LinkedIn
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="mailto:nareshmadhur@gmail.com"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
              >
                Email
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
              Thanks
            </div>
            <div className="mt-5 grid gap-4">
              <ExternalCard
                title="OpenF1"
                icon="🏎️"
                description="Race-weekend timing data helps keep the calendar accurate. Thanks to the OpenF1 team for making it available."
                href="https://openf1.org/docs"
                cta="Visit OpenF1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-400" />
              <h2 className="text-xl font-black tracking-tight text-white">How it works</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-white/5 px-4 py-3">🗓️ One shared race calendar powers every group.</div>
              <div className="rounded-xl bg-white/5 px-4 py-3">🔄 Race-weekend timing stays aligned with the season.</div>
              <div className="rounded-xl bg-white/5 px-4 py-3">✅ Results are checked before points are published.</div>
              <div className="rounded-xl bg-white/5 px-4 py-3">🏆 Groups compare results on top of the same race source.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-400" />
              <h2 className="text-xl font-black tracking-tight text-white">Independent</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-white/5 px-4 py-3">🧭 Built independently.</div>
              <div className="rounded-xl bg-white/5 px-4 py-3">🙏 Helpful data sources are credited clearly.</div>
              <div className="rounded-xl bg-white/5 px-4 py-3">🏎️ Race references are used for context only.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-red-300" />
              <h2 className="text-xl font-black tracking-tight text-white">Want a private group?</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Email support and we will help set up a free private scoreboard for your office, family, or friends.
            </p>
            <a
              href="mailto:nareshmadhur@gmail.com?subject=Flormula1%20group%20setup"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-50 transition-colors hover:bg-red-500/25"
            >
              Email support
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
