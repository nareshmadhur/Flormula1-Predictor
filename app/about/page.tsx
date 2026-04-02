import type { Metadata } from 'next'
import { ArrowUpRight, Database, HeartHandshake, UserRound } from 'lucide-react'
import { PendingLink } from '@/components/ui/pending-link'
import { getAbsoluteUrl } from '@/utils/site'

export const metadata: Metadata = {
  title: 'About',
  description: 'Credits, maintainer references, and external services behind FLO-RMULA1.',
  alternates: {
    canonical: getAbsoluteUrl('/about'),
  },
}

function ExternalCard({
  title,
  description,
  href,
  cta,
}: {
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5 shadow-xl">
      <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
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
          About FLO-RMULA1
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">Who built it and what powers it</h1>
        <p className="mt-3 max-w-3xl text-base text-slate-300">
          FLO-RMULA1 is a Formula 1 prediction pool with a shared race calendar, group-based competition, and a public season story.
          This page tracks the people and services behind the product.
        </p>

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
            <p className="mt-2 text-sm text-slate-300">AI Enthusiast · Musician · Photographer</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Naresh builds FLO-RMULA1 and keeps shaping it as a product. His broader work spans business intelligence,
              analytics, AI leadership, music, and photography. His own site describes that focus as building
              data-driven organizations through governance, innovation, and strong sponsorship.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="https://nareshmadhur.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
              >
                Website
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
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
              <Database className="h-4 w-4 text-red-400" />
              Data and platform
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ExternalCard
                title="OpenF1"
                description="Race weekend session timings for schedule sync. Huge thanks to the OpenF1 team for making this API available for free."
                href="https://openf1.org/docs"
                cta="Open docs"
              />
              <ExternalCard
                title="Supabase"
                description="Authentication, database, row-level security, and server-side data access for the prediction pool."
                href="https://supabase.com"
                cta="Open Supabase"
              />
              <ExternalCard
                title="Next.js"
                description="Application framework powering the public season story, private member experience, and admin tools."
                href="https://nextjs.org"
                cta="Open Next.js"
              />
              <ExternalCard
                title="Vercel"
                description="Hosting and deployment for the live app and its public pages."
                href="https://vercel.com"
                cta="Open Vercel"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
            <h2 className="text-xl font-black tracking-tight text-white">How race data works</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>One shared race calendar powers the whole product.</p>
              <p>Platform admins can import schedule and session times from OpenF1, review them, and sync them into the app.</p>
              <p>Official podium results and bonus answers are still reviewed and entered inside FLO-RMULA1 by admins.</p>
              <p>Group competition sits on top of that shared schedule instead of duplicating race data per group.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
            <h2 className="text-xl font-black tracking-tight text-white">Why this page exists</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>This is the reference page for product ownership and user-facing dependencies.</p>
              <p>When FLO-RMULA1 adds a new external service, data source, or major collaborator, it should be listed here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
