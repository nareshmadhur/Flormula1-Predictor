import type { Metadata } from 'next'
import {
  Aperture,
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheck,
  Database,
  Flag,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PendingLink } from '@/components/ui/pending-link'
import { getAbsoluteUrl } from '@/utils/site'

export const metadata: Metadata = {
  title: 'About',
  description: 'About Flormula1, a free Formula 1 scoreboard for private prediction groups. No betting or cash play.',
  alternates: {
    canonical: getAbsoluteUrl('/about'),
  },
}

type IconText = {
  title: string
  description: string
  icon: LucideIcon
  iconClassName?: string
}

const featurePoints: IconText[] = [
  {
    title: 'Podium picks',
    description: 'Collect top-three predictions before the FP1 lock for each race weekend.',
    icon: Flag,
    iconClassName: 'text-red-300',
  },
  {
    title: 'Transparent standings',
    description: 'Apply clear points logic and keep season tables easy to review.',
    icon: ChartNoAxesCombined,
    iconClassName: 'text-cyan-300',
  },
  {
    title: 'Private groups',
    description: 'Run a focused league for friends, family, colleagues, or community groups.',
    icon: UsersRound,
    iconClassName: 'text-emerald-300',
  },
]

const operatingModel: IconText[] = [
  {
    title: 'Shared race calendar',
    description: 'A maintained season schedule keeps race references and prediction locks consistent across groups.',
    icon: CalendarDays,
  },
  {
    title: 'Race-weekend workflow',
    description: 'Each round moves from predictions to results to standings without changing the underlying source of truth.',
    icon: Flag,
  },
  {
    title: 'Reviewed results',
    description: 'Results are checked before points are published so group tables remain dependable.',
    icon: CircleCheck,
  },
  {
    title: 'Season comparison',
    description: 'Groups compare performance on the same scoring model across the full championship calendar.',
    icon: Trophy,
  },
]

const independencePoints = [
  'Built and maintained independently.',
  'External data sources are credited where they support trust and accuracy.',
  'Race references are used for event context and scoreboard clarity only.',
]

const portfolioSignals: Array<{
  label: string
  icon: LucideIcon
  iconClassName: string
}> = [
  {
    label: 'Technology',
    icon: Terminal,
    iconClassName: 'text-blue-300',
  },
  {
    label: 'Music',
    icon: AudioLines,
    iconClassName: 'text-fuchsia-300',
  },
  {
    label: 'Visual storytelling',
    icon: Aperture,
    iconClassName: 'text-cyan-300',
  },
]

const socialLinks = [
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/in/naresh-madhur',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/nareshmadhur',
  },
  {
    label: '@nareshmadhur',
    href: 'https://www.instagram.com/nareshmadhur',
  },
  {
    label: '@naresh.sings',
    href: 'https://www.instagram.com/naresh.sings',
  },
  {
    label: '@nareshteaches',
    href: 'https://www.youtube.com/@nareshteaches',
  },
]

function FeaturePoint({ title, description, icon: Icon, iconClassName = 'text-red-300' }: IconText) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <Icon className={`h-5 w-5 ${iconClassName}`} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  )
}

function OperatingRow({ title, description, icon: Icon }: IconText) {
  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[2.75rem_1fr]">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <Icon className="h-5 w-5 text-red-300" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  )
}

export default function AboutPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="rounded-lg border border-white/10 bg-card p-6 shadow-2xl sm:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-slate-300">
          <ShieldCheck className="h-3.5 w-3.5 text-red-400" />
          About Flormula1
        </div>
        <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white">
          A focused scoreboard for private F1 prediction groups
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
          Flormula1 helps private groups collect podium picks, apply transparent scoring, and follow a season table
          after every Grand Prix.
        </p>
        <p className="mt-3 max-w-3xl text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
          Free to use. No betting, wagers, or cash prizes.
        </p>

        <div className="mt-6 grid gap-5 border-t border-white/10 pt-6 md:grid-cols-3">
          {featurePoints.map((feature) => (
            <FeaturePoint key={feature.title} {...feature} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <PendingLink
            href="/season"
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/12 px-4 py-2 text-sm font-medium text-red-50 transition-colors hover:bg-red-500/18"
          >
            View season
          </PendingLink>
          <PendingLink
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
          >
            View leaderboard
          </PendingLink>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-6">
          <section className="rounded-lg border border-white/10 bg-card p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <UserRound className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Maintainer</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Built by Naresh Madhur</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Naresh designs and maintains Flormula1 as an independent fan product, combining software, analytics,
              and race-weekend operations into a lightweight group experience.
            </p>

            <div className="mt-5 rounded-lg border border-blue-300/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(192,132,252,0.14))] p-4 shadow-[0_18px_45px_rgba(59,130,246,0.12)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Sparkles className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100/80">
                      Personal portfolio
                    </div>
                    <a
                      href="https://nareshmadhur.com"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-2 text-xl font-black tracking-tight text-white underline decoration-cyan-300/70 decoration-2 underline-offset-4 transition-colors hover:text-cyan-100"
                    >
                      nareshmadhur.com
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {portfolioSignals.map((signal) => {
                    const Icon = signal.icon

                    return (
                      <span
                        key={signal.label}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-100"
                      >
                        <Icon className={`h-4 w-4 ${signal.iconClassName}`} />
                        {signal.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
                >
                  {link.label}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ))}
              <a
                href="mailto:nareshmadhur@gmail.com"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
              >
                Email
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-card p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <Database className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Data credit</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">OpenF1</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Public race-weekend data from OpenF1 helps validate calendar and timing information. Flormula1 credits
              external services clearly where they support the product experience.
            </p>
            <a
              href="https://openf1.org/docs"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
            >
              Visit OpenF1
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-white/10 bg-card p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-400" />
              <h2 className="text-xl font-black tracking-tight text-white">How it works</h2>
            </div>
            <div className="mt-5 divide-y divide-white/10">
              {operatingModel.map((item) => (
                <OperatingRow key={item.title} {...item} />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-card p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-400" />
              <h2 className="text-xl font-black tracking-tight text-white">Independent</h2>
            </div>
            <ul className="mt-5 divide-y divide-white/10 text-sm text-slate-300">
              {independencePoints.map((point) => (
                <li key={point} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <span className="leading-6">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-red-300" />
              <h2 className="text-xl font-black tracking-tight text-white">Set up a private group</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Email support to create a free private scoreboard for your office, family, friends, or community group.
            </p>
            <a
              href="mailto:nareshmadhur@gmail.com?subject=Flormula1%20group%20setup"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-50 transition-colors hover:bg-red-500/25"
            >
              Email support
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </section>
        </div>
      </div>
    </div>
  )
}
