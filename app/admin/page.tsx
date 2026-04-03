import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Settings, ChevronRight } from 'lucide-react'
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader
        eyebrow="Admin"
        title="Control room"
        description="Run race weekends, import schedules, manage access, and repair standings."
        aside={<Settings className="h-8 w-8 text-red-500" />}
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_22rem]">

        <div className="space-y-4">
          <SectionHeader eyebrow="Calendar" title="Race weekends" />

          <div className="mt-4 bg-card border border-white/5 rounded-2xl shadow-xl overflow-hidden divide-y divide-white/5">
            {(!races || races.length === 0) ? (
              <div className="p-8 text-center text-slate-500 italic">No races defined.</div>
            ) : (
              typedRaces.map((race) => (
                <PendingLink
                  href={`/admin/races/${race.id}`}
                  key={race.id}
                  className="group grid gap-3 p-5 transition-colors hover:bg-white/[0.02] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-bold text-red-500 uppercase tracking-widest">
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

        <div className="space-y-4">
          <SectionHeader eyebrow="Tools" title="Quick actions" />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <PendingLink
              href="/admin/data"
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold leading-tight text-white">Drivers & teams</h2>
                <p className="mt-1 break-words text-sm text-slate-400">Reference data for the current grid.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
            </PendingLink>

            <PendingLink
              href="/admin/schedule"
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold leading-tight text-white">Season sync</h2>
                <p className="mt-1 break-words text-sm text-slate-400">Import OpenF1 timings and review race updates.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
            </PendingLink>

            <PendingLink
              href="/admin/tenants"
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold leading-tight text-white">Groups & access</h2>
                <p className="mt-1 break-words text-sm text-slate-400">{tenantCount || 0} groups and account permissions.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
            </PendingLink>

            {access.tenantId && (
              <PendingLink
                href="/admin/tenant"
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-bold leading-tight text-white">Group workspace</h2>
                  <p className="mt-1 break-words text-sm text-slate-400">Check the competition from your group’s view.</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
              </PendingLink>
            )}
          </div>

          <MaintenanceSection />
        </div>

      </div>

      <div className="space-y-6">
        <SectionHeader eyebrow="Create" title="Add race weekend" />
        <CreateRaceForm circuits={circuits || []} />
      </div>
    </div>
  )
}
