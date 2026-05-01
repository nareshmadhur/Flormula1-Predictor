import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Settings, ChevronRight, ClipboardCheck, CalendarSync, Database, Flag, PlusCircle, Users, UserCheck } from 'lucide-react'
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
  const typedRaces = (races || []) as AdminRace[]
  const openCount = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'upcoming').length
  const liveCount = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'locked').length
  const resultsCount = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'completed').length

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader
        eyebrow="Admin"
        title="Control room"
        description="Review OpenF1 updates, publish official results, and watch group submission health without digging through long lists first."
        aside={<Settings className="h-8 w-8 text-red-500" />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-5 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-sky-100">Open soon</div>
          <div className="mt-3 text-3xl font-black italic text-white">{openCount}</div>
          <p className="mt-2 text-sm text-sky-100/80">Weekends still open for picks and setup.</p>
        </div>

        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-amber-100">Live weekends</div>
          <div className="mt-3 text-3xl font-black italic text-white">{liveCount}</div>
          <p className="mt-2 text-sm text-amber-100/80">Weekends already locked and actively running.</p>
        </div>

        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-red-100">Need results</div>
          <div className="mt-3 text-3xl font-black italic text-white">{resultsCount}</div>
          <p className="mt-2 text-sm text-red-100/80">Finished weekends waiting for official results or rescoring.</p>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader eyebrow="Tools" title="Quick actions" />

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
              <h2 className="break-words text-lg font-bold leading-tight text-white">Review season updates</h2>
              <p className="mt-1 break-words text-sm text-slate-400">Import OpenF1 timing changes and add missing weekends.</p>
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
              <h2 className="break-words text-lg font-bold leading-tight text-white">Source matching data</h2>
              <p className="mt-1 break-words text-sm text-slate-400">Keep drivers and circuits aligned so OpenF1 imports map cleanly.</p>
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
              <h2 className="break-words text-lg font-bold leading-tight text-white">Groups and roles</h2>
              <p className="mt-1 break-words text-sm text-slate-400">{tenantCount || 0} groups and all account permissions.</p>
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
                  Group invite
                </div>
                <h2 className="break-words text-lg font-bold leading-tight text-white">Invite members</h2>
                <p className="mt-1 break-words text-sm text-slate-400">Create share links for your current group.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
            </PendingLink>
          )}

          <PendingLink
            href="#create-race"
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-amber-500/10 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100">
                <PlusCircle className="h-3.5 w-3.5 text-amber-300" />
                Manual fallback
              </div>
              <h2 className="break-words text-lg font-bold leading-tight text-white">Add a race manually</h2>
              <p className="mt-1 break-words text-sm text-slate-400">Use only when OpenF1 is missing a weekend or circuit mapping cannot be resolved.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
          </PendingLink>
        </div>

        <MaintenanceSection />
      </div>

      <div className="space-y-4">
        <SectionHeader eyebrow="Calendar" title="Race weekends" description="Open any weekend for detailed edits, OpenF1 sync, scoring, or historic entries." />

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
