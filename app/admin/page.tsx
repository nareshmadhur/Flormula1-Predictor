import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarSync, ChevronRight, ClipboardCheck, Database, MailCheck, PlusCircle, Settings, Users } from 'lucide-react'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { getAdminRaceStatusClasses, getAdminRaceStatusLabel } from '@/utils/admin-race-status'
import { CreateRaceForm } from '@/components/ui/create-race-form'
import { MaintenanceSection } from '@/components/ui/maintenance-section'
import { getAdminAccessContext } from '@/utils/admin-access'
import { PendingLink } from '@/components/ui/pending-link'
import { SectionHeader } from '@/components/ui/section-header'

export const revalidate = 0

type AdminRace = {
  id: string
  round: number
  season: number
  race_name: string
  status: 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'
  race_start_at: string
  prediction_lock_at: string
  circuits?: {
    name?: string | null
    emoji?: string | null
  } | null
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')

  if (access.isTenantAdmin) {
    redirect('/admin/tenant')
  }

  if (!access.isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <h1 className="mb-4 text-3xl font-bold text-red-500">Platform Admin Only</h1>
        <p className="text-slate-400">Race operations are limited to platform admins.</p>
        <PendingLink href="/" className="mt-6 text-slate-300 underline">Return home</PendingLink>
      </div>
    )
  }

  const { data: races } = await supabase
    .from('races')
    .select('*, circuits(name, emoji)')
    .order('round', { ascending: true })

  const { data: circuits } = await supabase.from('circuits').select('*').order('name')
  const { count: tenantCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true })
  const unassignedUsersWithTest = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .is('tenant_id', null)
    .eq('is_test', false)
  const unassignedUsersResult = unassignedUsersWithTest.error?.message?.includes('is_test')
    ? await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .is('tenant_id', null)
    : unassignedUsersWithTest
  const typedRaces = (races || []) as AdminRace[]
  const setupRaces = typedRaces
    .filter((race) => getEffectiveRaceStatus(race) === 'upcoming')
    .sort((left, right) => new Date(left.race_start_at).getTime() - new Date(right.race_start_at).getTime())
  const nextSetupRace = setupRaces[0] || null
  const liveRaces = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'locked')
  const resultRaces = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'completed')
  const liveCount = liveRaces.length
  const resultsCount = resultRaces.length
  const unassignedCount = unassignedUsersResult.count || 0
  const needsAttentionCount = resultsCount + liveCount + unassignedCount
  const firstLiveRace = liveRaces[0] || null
  const reviewRaces = [...resultRaces, ...liveRaces].sort(
    (left, right) => new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime()
  )
  const raceSetupHref = nextSetupRace ? `/admin/races/${nextSetupRace.id}#openf1-sync` : '/admin/schedule'

  return (
    <div className="space-y-7 animate-in fade-in duration-500">
      <SectionHeader
        eyebrow="Admin"
        title="Admin"
        description="Handle race setup, results, groups, and emails from one place."
        aside={<Settings className="h-8 w-8 text-red-500" />}
      />

      <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-xl sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          <span>{needsAttentionCount} open item{needsAttentionCount === 1 ? '' : 's'}</span>
          <span className="text-slate-700">/</span>
          <span>{tenantCount || 0} groups</span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <PendingLink
            href="/admin/results"
            className="group block min-w-0 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 transition-colors hover:bg-red-500/14"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold uppercase leading-5 tracking-[0.18em] text-red-100 sm:tracking-[0.22em]">
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              Results
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
              <div className="text-5xl font-bold leading-none text-white">{resultsCount}</div>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold tracking-tight text-white">Races waiting for results</h2>
                <p className="mt-1 break-words text-sm text-red-100/80">
                  Enter podiums before scoring. Group bonus answers live in tenant admin.
                </p>
              </div>
            </div>
            <span className="mt-5 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors group-hover:bg-red-500">
              Open results
              <ChevronRight className="h-4 w-4" />
            </span>
          </PendingLink>

          <div className="grid gap-3">
            <PendingLink
              href={firstLiveRace ? `/admin/races/${firstLiveRace.id}` : '/admin/schedule'}
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/8 p-4 transition-colors hover:bg-amber-500/12"
            >
              <div className="min-w-0">
                <div className="break-words text-xs font-bold uppercase leading-5 tracking-[0.16em] text-amber-100 sm:tracking-[0.2em]">Locked races</div>
                <div className="mt-1 text-2xl font-bold text-white">{liveCount}</div>
                <p className="mt-1 break-words text-sm text-amber-100/75">Prediction windows are closed.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-amber-100/70 transition-colors group-hover:text-white" />
            </PendingLink>

            <PendingLink
              href="/admin/tenants"
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-sky-500/15 bg-sky-500/8 p-4 transition-colors hover:bg-sky-500/12"
            >
              <div className="min-w-0">
                <div className="break-words text-xs font-bold uppercase leading-5 tracking-[0.16em] text-sky-100 sm:tracking-[0.2em]">Unassigned users</div>
                <div className="mt-1 text-2xl font-bold text-white">{unassignedCount}</div>
                <p className="mt-1 break-words text-sm text-sky-100/75">
                  People who are not in a group yet.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-sky-100/70 transition-colors group-hover:text-white" />
            </PendingLink>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-red-500/20 bg-red-500/8 p-5 shadow-xl md:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">Next race setup</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {nextSetupRace ? nextSetupRace.race_name : 'No open race to set up'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-red-100/80">
              {nextSetupRace
                ? 'Review schedule timing and OpenF1 linkage. Group bonus questions are managed by tenant admins.'
                : 'Use schedule sync to create or open the next race first.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <PendingLink
              href={raceSetupHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
            >
              {nextSetupRace ? 'Open setup' : 'Open schedule sync'}
              <ChevronRight className="h-4 w-4" />
            </PendingLink>
            {nextSetupRace && (
              <PendingLink
                href={`/admin/races/${nextSetupRace.id}#official-results`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-5 py-3 font-bold text-red-50 transition-colors hover:bg-white/10"
              >
                Enter results
              </PendingLink>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Sections"
          title="Admin sections"
          description="Choose the area you need."
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PendingLink
            href={raceSetupHref}
            className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-4 shadow-xl transition-colors hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="mb-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase leading-5 tracking-[0.14em] text-slate-300 sm:tracking-[0.18em]">
                <CalendarSync className="h-3.5 w-3.5 shrink-0 text-red-400" />
                Race setup
              </div>
              <h2 className="text-base font-bold leading-tight text-white">Race setup</h2>
              <p className="mt-1 break-words text-sm text-slate-400">
                Update race timing, source links, and official result flow.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
          </PendingLink>

          <PendingLink
            href="/admin/tenants"
            className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-4 shadow-xl transition-colors hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="mb-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase leading-5 tracking-[0.14em] text-slate-300 sm:tracking-[0.18em]">
                <Users className="h-3.5 w-3.5 shrink-0 text-red-400" />
                Access
              </div>
              <h2 className="text-base font-bold leading-tight text-white">Groups & users</h2>
              <p className="mt-1 break-words text-sm text-slate-400">Manage groups, roles, and rare setup gaps.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
          </PendingLink>

          <PendingLink
            href="/admin/notifications"
            className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-4 shadow-xl transition-colors hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="mb-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase leading-5 tracking-[0.14em] text-slate-300 sm:tracking-[0.18em]">
                <MailCheck className="h-3.5 w-3.5 shrink-0 text-red-400" />
                Email
              </div>
              <h2 className="text-base font-bold leading-tight text-white">Notifications</h2>
              <p className="mt-1 break-words text-sm text-slate-400">Review preferences, delivery status, and recent sends.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
          </PendingLink>

          <PendingLink
            href={access.tenantId ? '/admin/tenant' : '/admin/tenants'}
            className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-4 shadow-xl transition-colors hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="mb-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase leading-5 tracking-[0.14em] text-slate-300 sm:tracking-[0.18em]">
                <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-red-400" />
                Group admin
              </div>
              <h2 className="text-base font-bold leading-tight text-white">Invites and entries</h2>
              <p className="mt-1 break-words text-sm text-slate-400">Manage invite links and group race entries.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
          </PendingLink>
        </div>
      </section>

      {reviewRaces.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Current races"
            title="Races to review"
            description="Only locked races or races waiting for results appear here."
          />

          <div className="overflow-hidden rounded-2xl border border-white/5 bg-card shadow-xl">
            {reviewRaces.map((race) => (
              <PendingLink
                href={`/admin/races/${race.id}`}
                key={race.id}
                className="group grid min-w-0 gap-3 border-b border-white/5 p-4 transition-colors last:border-b-0 hover:bg-white/[0.02] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                    Round {race.round} • {race.season}
                  </div>
                  <div className="break-words text-base font-bold leading-tight text-white">{race.race_name}</div>
                  <div className="break-words text-sm text-slate-400">
                    {race.circuits?.name} {race.circuits?.emoji}
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 lg:justify-end">
                  <div className="max-w-full rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-left text-[11px] font-bold uppercase leading-4 tracking-[0.14em] sm:tracking-[0.18em] lg:text-right">
                    <span className={getAdminRaceStatusClasses(getEffectiveRaceStatus(race))}>
                      {getAdminRaceStatusLabel(getEffectiveRaceStatus(race))}
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
                </div>
              </PendingLink>
            ))}
          </div>
        </section>
      )}

      <details className="group border-t border-white/10 pt-5">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="mb-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold uppercase leading-5 tracking-[0.14em] text-amber-100 sm:tracking-[0.18em]">
              <PlusCircle className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              Advanced
            </div>
            <h2 className="text-lg font-bold leading-tight text-white">Maintenance tools</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Use these for source sync issues, historic corrections, or manual data fixes.
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
        </summary>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <MaintenanceSection />

          <div className="space-y-4">
            <PendingLink
              href="/admin/data"
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <div className="mb-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase leading-5 tracking-[0.14em] text-slate-300 sm:tracking-[0.18em]">
                  <Database className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  Reference
                </div>
                <h2 className="break-words text-base font-bold leading-tight text-white">Source mapping</h2>
                <p className="mt-1 break-words text-sm text-slate-400">
                  Fix driver or circuit matches only when schedule or result sync flags a mismatch.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
            </PendingLink>

            <div id="create-race" className="space-y-4 scroll-mt-24">
              <SectionHeader
                eyebrow="Manual fallback"
                title="Add race weekend"
                description="OpenF1 schedule sync should be the normal path. Create a weekend here only when the source cannot provide it yet."
              />
              <CreateRaceForm circuits={circuits || []} />
            </div>
          </div>
        </div>
      </details>

      <details className="group border-t border-white/10 pt-5">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="break-words text-xs font-bold uppercase leading-5 tracking-[0.16em] text-slate-500 sm:tracking-[0.22em]">Calendar reference</div>
            <h2 className="mt-1 text-lg font-bold leading-tight text-white">All race detail pages</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Open the full calendar only for inspection, exceptions, corrections, or advanced tools.
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
        </summary>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-card shadow-xl">
          {typedRaces.length === 0 ? (
            <div className="p-8 text-center italic text-slate-500">No races defined.</div>
          ) : (
            typedRaces.map((race) => (
              <PendingLink
                href={`/admin/races/${race.id}`}
                key={race.id}
                className="group grid min-w-0 gap-3 border-b border-white/5 p-4 transition-colors last:border-b-0 hover:bg-white/[0.02] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                    Round {race.round} • {race.season}
                  </div>
                  <div className="break-words text-base font-bold leading-tight text-white">{race.race_name}</div>
                  <div className="break-words text-sm text-slate-400">
                    {race.circuits?.name} {race.circuits?.emoji}
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 lg:justify-end">
                  <div className="max-w-full rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-left text-[11px] font-bold uppercase leading-4 tracking-[0.14em] sm:tracking-[0.18em] lg:text-right">
                    <span className={getAdminRaceStatusClasses(getEffectiveRaceStatus(race))}>
                      {getAdminRaceStatusLabel(getEffectiveRaceStatus(race))}
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
                </div>
              </PendingLink>
            ))
          )}
        </div>
      </details>
    </div>
  )
}
