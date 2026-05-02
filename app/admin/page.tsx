import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, Settings, ChevronRight, ClipboardCheck, CalendarSync, Database, Flag, PlusCircle, Users, UserCheck } from 'lucide-react'
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

  // Fetch all races
  const { data: races } = await supabase
    .from('races')
    .select('*, circuits(name, emoji)')
    .order('round', { ascending: true })

  // Fetch circuits for the 'create' form
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
  const liveCount = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'locked').length
  const resultsCount = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'completed').length
  const unassignedCount = unassignedUsersResult.count || 0
  const needsAttentionCount = resultsCount + liveCount + unassignedCount

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader
        eyebrow="Admin"
        title="Action queue"
        description="Start with live operational blockers: results to publish, active weekends, and people who still need a group."
        aside={<Settings className="h-8 w-8 text-red-500" />}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            <AlertCircle className="h-4 w-4 text-red-400" />
            Total queue
          </div>
          <div className="mt-3 text-3xl font-black italic text-white">{needsAttentionCount}</div>
          <p className="mt-2 text-sm text-slate-400">Items that need an admin decision or follow-up.</p>
        </div>

        <PendingLink href="/admin/results" className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 shadow-xl transition-colors hover:bg-red-500/14">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-red-100">Need results</div>
          <div className="mt-3 text-3xl font-black italic text-white">{resultsCount}</div>
          <p className="mt-2 text-sm text-red-100/80">Finished weekends waiting for official results or scoring.</p>
        </PendingLink>

        <PendingLink href="/admin" className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 shadow-xl transition-colors hover:bg-amber-500/14">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-amber-100">Live weekends</div>
          <div className="mt-3 text-3xl font-black italic text-white">{liveCount}</div>
          <p className="mt-2 text-sm text-amber-100/80">Locked races currently in motion.</p>
        </PendingLink>

        <PendingLink href="/admin/tenants" className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-5 shadow-xl transition-colors hover:bg-sky-500/14">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-sky-100">Needs group</div>
          <div className="mt-3 text-3xl font-black italic text-white">{unassignedCount || 0}</div>
          <p className="mt-2 text-sm text-sky-100/80">Users who cannot play until they are assigned.</p>
        </PendingLink>
      </div>

      <div className="space-y-4">
        <SectionHeader eyebrow="Workflows" title="Primary actions" />

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <PendingLink
            href="/admin/results"
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 shadow-xl transition-colors hover:bg-red-500/14"
          >
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-red-100">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Results desk
              </div>
              <h2 className="break-words text-lg font-bold leading-tight text-white">Save official results</h2>
              <p className="mt-1 break-words text-sm text-red-100/80">
                Publish multiple podiums and bonus answers in one pass.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-red-100/70 transition-colors group-hover:text-white" />
          </PendingLink>

          {access.tenantId && (
            <PendingLink
              href="/admin/tenant"
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 shadow-xl transition-colors hover:bg-emerald-500/14"
            >
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100">
                  <UserCheck className="h-3.5 w-3.5" />
                  Group coverage
                </div>
                <h2 className="break-words text-lg font-bold leading-tight text-white">Prediction submissions</h2>
                <p className="mt-1 break-words text-sm text-emerald-100/80">
                  See how many people in your group have entered and who still needs a nudge.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-emerald-100/70 transition-colors group-hover:text-white" />
            </PendingLink>
          )}

          <PendingLink
            href="/admin/schedule"
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                <CalendarSync className="h-3.5 w-3.5 text-red-400" />
                Schedule sync
              </div>
              <h2 className="break-words text-lg font-bold leading-tight text-white">Season sync</h2>
              <p className="mt-1 break-words text-sm text-slate-400">Pull OpenF1 timing changes and review any missing weekends.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
          </PendingLink>

          <PendingLink
            href="/admin/data"
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                <Database className="h-3.5 w-3.5 text-red-400" />
                Reference data
              </div>
              <h2 className="break-words text-lg font-bold leading-tight text-white">Source mapping</h2>
              <p className="mt-1 break-words text-sm text-slate-400">Only needed when driver or circuit names stop matching the source cleanly.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
          </PendingLink>

          <PendingLink
            href="/admin/tenants"
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                <Users className="h-3.5 w-3.5 text-red-400" />
                Access
              </div>
              <h2 className="break-words text-lg font-bold leading-tight text-white">Groups & access</h2>
              <p className="mt-1 break-words text-sm text-slate-400">{tenantCount || 0} groups and every account permission in one place.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
          </PendingLink>

          {access.tenantId && (
            <PendingLink
              href="/admin/tenant#group-invites"
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                  <Flag className="h-3.5 w-3.5 text-red-400" />
                  Invite links
                </div>
                <h2 className="break-words text-lg font-bold leading-tight text-white">Invite people</h2>
                <p className="mt-1 break-words text-sm text-slate-400">Create share links for your current group.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
            </PendingLink>
          )}
        </div>

        <MaintenanceSection />

        <details className="group rounded-2xl border border-amber-500/10 bg-card p-5 shadow-xl">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100">
                <PlusCircle className="h-3.5 w-3.5 text-amber-300" />
                Manual tools
              </div>
              <h2 className="text-lg font-bold leading-tight text-white">Fallback only</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Keep these hidden unless OpenF1 cannot provide a weekend or the source mapping needs manual repair.
              </p>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
          </summary>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PendingLink
              href="#create-race"
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/8 p-4 transition-colors hover:bg-amber-500/12"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">Create race manually</div>
                <p className="mt-1 text-sm text-slate-300">Use only when a weekend is missing from the source.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-amber-200/70 transition-colors group-hover:text-white" />
            </PendingLink>

            <PendingLink
              href="/admin/data"
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors hover:bg-black/30"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">Open source mapping</div>
                <p className="mt-1 text-sm text-slate-300">Fix circuit or driver matches only when sync review flags them.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-colors group-hover:text-white" />
            </PendingLink>
          </div>
        </details>
      </div>

      <div className="space-y-4">
        <SectionHeader eyebrow="Calendar" title="Race detail pages" description="Use individual race pages for inspection, exceptions, corrections, or advanced tools." />

        <div className="bg-card overflow-hidden rounded-2xl border border-white/5 shadow-xl">
          {(!races || races.length === 0) ? (
            <div className="p-8 text-center italic text-slate-500">No races defined.</div>
          ) : (
            typedRaces.map((race) => (
              <PendingLink
                href={`/admin/races/${race.id}`}
                key={race.id}
                className="group grid gap-3 border-b border-white/5 p-5 transition-colors last:border-b-0 hover:bg-white/[0.02] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                    Round {race.round} • {race.season}
                  </div>
                  <div className="break-words text-lg font-bold leading-tight text-white">{race.race_name}</div>
                  <div className="break-words text-sm text-slate-400">
                    {race.circuits?.name} {race.circuits?.emoji}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-right">
                    <span className={`${getAdminRaceStatusClasses(getEffectiveRaceStatus(race))}`}>
                      {getAdminRaceStatusLabel(getEffectiveRaceStatus(race))}
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
                </div>
              </PendingLink>
            ))
          )}
        </div>
      </div>

      <div id="create-race" className="space-y-6 scroll-mt-24">
        <SectionHeader
          eyebrow="Manual fallback"
          title="Add race weekend"
          description="OpenF1 schedule sync should be the normal path. Create a weekend here only when the source cannot provide it yet."
        />
        <CreateRaceForm circuits={circuits || []} />
      </div>
    </div>
  )
}
