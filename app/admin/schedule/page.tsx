import { format } from 'date-fns'
import { redirect } from 'next/navigation'
import { CalendarSync, CheckCircle2, CircleAlert, ExternalLink, Flag, PlusCircle, Radio, Timer } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getCurrentSeason } from '@/utils/season'
import {
  buildOpenF1ScheduleReview,
  fetchOpenF1SeasonSchedule,
  getOpenF1ErrorMessage,
  type ExistingRaceForImport,
  type OpenF1CircuitLookup,
  type OpenF1ImportedRace,
  type OpenF1ScheduleReviewRow,
} from '@/utils/openf1'
import { ApplyScheduleImportForm } from '@/app/admin/schedule/apply-schedule-import-form'
import { CreateCircuitMatchForm } from '@/app/admin/schedule/create-circuit-match-form'
import { CreateMissingCircuitsForm } from '@/app/admin/schedule/create-missing-circuits-form'
import { PendingLink } from '@/components/ui/pending-link'
import { PageBackLink } from '@/components/ui/page-back-link'
import { ADMIN_TIME_LABEL, formatAmsterdamDateTime } from '@/utils/amsterdam-time'

export const revalidate = 0

type PageProps = {
  searchParams: Promise<{
    season?: string | string[] | undefined
    filter?: string | string[] | undefined
  }>
}

type ScheduleFilter = 'all' | 'sync' | 'add' | 'setup'

function resolveSeason(rawSeason: string | string[] | undefined, fallbackSeason: number) {
  const value = Array.isArray(rawSeason) ? rawSeason[0] : rawSeason
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 2020 ? parsed : fallbackSeason
}

function resolveFilter(rawFilter: string | string[] | undefined): ScheduleFilter {
  const value = Array.isArray(rawFilter) ? rawFilter[0] : rawFilter
  if (value === 'sync' || value === 'add' || value === 'setup') {
    return value
  }
  return 'all'
}

function formatSessionDate(value: string | null) {
  if (!value) return null
  return formatAmsterdamDateTime(value) || format(new Date(value), 'EEE d MMM, HH:mm')
}

function getReviewToneClasses(row: OpenF1ScheduleReviewRow) {
  if (row.tone === 'update') {
    return {
      frame: 'border-amber-500/20 bg-amber-500/8',
      badge: 'border-amber-500/25 bg-amber-500/14 text-amber-100',
      round: 'text-amber-300',
      cta: 'border-amber-500/25 bg-amber-500/12 text-amber-50 hover:bg-amber-500/18',
    }
  }

  if (row.tone === 'create') {
    return {
      frame: 'border-emerald-500/20 bg-emerald-500/8',
      badge: 'border-emerald-500/25 bg-emerald-500/14 text-emerald-100',
      round: 'text-emerald-300',
      cta: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-50 hover:bg-emerald-500/18',
    }
  }

  if (row.tone === 'attention') {
    return {
      frame: 'border-red-500/20 bg-red-500/8',
      badge: 'border-red-500/25 bg-red-500/14 text-red-100',
      round: 'text-red-300',
      cta: 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
    }
  }

  return {
    frame: 'border-white/10 bg-black/20',
    badge: 'border-white/10 bg-white/5 text-slate-100',
    round: 'text-slate-300',
    cta: 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
  }
}

function getReviewLabel(row: OpenF1ScheduleReviewRow) {
  if (row.action === 'update') return 'Ready to sync'
  if (row.action === 'create') return 'Ready to add'
  if (!row.existingRace && !row.circuitMatch) return 'Needs circuit setup'
  return 'Already aligned'
}

function SessionChip({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  if (!value) return null

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-slate-200">
      <span className="text-slate-400">{label}</span>
      <span>{formatSessionDate(value)}</span>
    </span>
  )
}

function PreviewCard({ row }: { row: OpenF1ScheduleReviewRow }) {
  const tone = getReviewToneClasses(row)
  const imported = row.imported
  const summaryChangeLabels = row.fieldChanges.slice(0, 4).map((change) => change.label)
  const hasMoreChanges = row.fieldChanges.length > summaryChangeLabels.length

  return (
    <div className={`rounded-2xl border p-4 shadow-xl ${tone.frame}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.22em]">
            <span className={tone.round}>Round {imported.round}</span>
            <span className={`rounded-full border px-2.5 py-1 tracking-[0.2em] ${tone.badge}`}>
              {getReviewLabel(row)}
            </span>
            {imported.isSprintWeekend && (
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-100 tracking-[0.2em]">
                Sprint
              </span>
            )}
          </div>

          <h2 className="mt-2 text-xl font-black tracking-tight text-white">{imported.raceName}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {imported.location}, {imported.countryName} · GMT {imported.gmtOffset}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {row.existingRace && (
            <PendingLink
              href={`/admin/races/${row.existingRace.id}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${tone.cta}`}
            >
              Open race
            </PendingLink>
          )}
          <a
            href={imported.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
          >
            Source
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <SessionChip label="FP1" value={imported.fp1At} />
        <SessionChip label="FP2" value={imported.fp2At} />
        <SessionChip label="FP3" value={imported.fp3At} />
        <SessionChip label="Quali" value={imported.qualiAt} />
        <SessionChip label="Sprint Q" value={imported.sprintQualiAt} />
        <SessionChip label="Sprint" value={imported.sprintAt} />
        <SessionChip label="Race" value={imported.raceStartAt} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200">
          {row.existingRace ? (
            <>
              <div className="font-semibold text-white">App match: {row.existingRace.race_name}</div>
              <div className="mt-1 text-slate-400">
                {row.fieldChanges.length > 0 ? (
                  <>
                    {row.fieldChanges.length} change{row.fieldChanges.length === 1 ? '' : 's'} detected
                    {summaryChangeLabels.length > 0 ? ` · ${summaryChangeLabels.join(', ')}` : ''}
                    {hasMoreChanges ? ' · more' : ''}
                  </>
                ) : (
                  'Already aligned with the current app schedule.'
                )}
              </div>
            </>
          ) : row.circuitMatch ? (
            <>
              <div className="font-semibold text-white">Ready to add</div>
              <div className="mt-1 text-slate-400">
                Circuit match found: {row.circuitMatch.name}
                {row.circuitMatch.emoji ? ` ${row.circuitMatch.emoji}` : ''}
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold text-white">Manual circuit setup needed</div>
              <div className="mt-1 text-slate-400">
                Create {imported.circuitShortName || imported.location} in your reference data, then rerun the preview.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CreateCircuitMatchForm
                  name={imported.circuitShortName || imported.location}
                  city={imported.location}
                  country={imported.countryName}
                />
                <PendingLink
                  href="/admin/data"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10"
                >
                  Open reference data
                </PendingLink>
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200">
          <div className="font-semibold text-white">Import source</div>
          <div className="mt-1 text-slate-400">OpenF1 sessions feed for meeting {imported.meetingKey}</div>
          <div className="mt-3 text-slate-300">Lock updates to FP1 - 5m automatically.</div>
        </div>
      </div>
    </div>
  )
}

export default async function AdminSchedulePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')
  if (!access.isPlatformAdmin) redirect('/admin')

  const fallbackSeason = await getCurrentSeason(supabase)
  const selectedSeason = resolveSeason(resolvedSearchParams.season, fallbackSeason)
  const activeFilter = resolveFilter(resolvedSearchParams.filter)

  const [{ data: existingRaces }, { data: circuits }] = await Promise.all([
    supabase
      .from('races')
      .select(
        'id, season, round, race_name, circuit_id, status, race_start_at, prediction_lock_at, fp1_at, fp2_at, fp3_at, quali_at, sprint_at, sprint_quali_at, external_race_key'
      )
      .eq('season', selectedSeason)
      .order('round', { ascending: true }),
    supabase.from('circuits').select('id, name, city, country, emoji').order('name'),
  ])

  let importedRaces: OpenF1ImportedRace[] = []
  let reviewRows: OpenF1ScheduleReviewRow[] = []
  let fetchError: string | null = null

  try {
    importedRaces = await fetchOpenF1SeasonSchedule(selectedSeason)
    reviewRows = buildOpenF1ScheduleReview(
      importedRaces,
      (existingRaces || []) as ExistingRaceForImport[],
      (circuits || []) as OpenF1CircuitLookup[]
    )
  } catch (error) {
    fetchError = getOpenF1ErrorMessage(error)
  }

  const readyUpdates = reviewRows.filter((row) => row.action === 'update').length
  const readyCreates = reviewRows.filter((row) => row.action === 'create').length
  const needsMapping = reviewRows.filter((row) => row.action === 'skip' && !row.existingRace && !row.circuitMatch).length
  const visibleRows = reviewRows.filter((row) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'sync') return row.action === 'update'
    if (activeFilter === 'add') return row.action === 'create'
    return row.action === 'skip' && !row.existingRace && !row.circuitMatch
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <PageBackLink href="/admin" label="Back to Admin" />
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-300">
            <Radio className="h-3.5 w-3.5 text-red-400" />
            OpenF1 schedule sync
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter text-red-500">
            Season sync
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            OpenF1 is the primary source. Review imported sessions here, then only step in manually when a circuit or weekend needs help.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <PendingLink
            href="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
          >
            Admin
          </PendingLink>
          <PendingLink
            href="/about"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
          >
            About data sources
          </PendingLink>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-[180px]">
              <label className="mb-2 block text-sm font-medium text-slate-300">Season</label>
              <input
                type="number"
                name="season"
                defaultValue={selectedSeason}
                min={2020}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-white outline-none ring-0 transition-colors focus:border-red-500/40"
              />
            </div>
            {activeFilter !== 'all' && <input type="hidden" name="filter" value={activeFilter} />}

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10"
            >
              Refresh preview
            </button>
          </form>
          <div className="mt-3 text-xs text-slate-500">Preview times are shown in {ADMIN_TIME_LABEL}.</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-slate-300">
            <CalendarSync className="h-4 w-4 text-red-400" />
            Review actions
          </div>
          <div className="space-y-3">
            <CreateMissingCircuitsForm
              season={selectedSeason}
              disabled={Boolean(fetchError || needsMapping === 0)}
            />
            <ApplyScheduleImportForm season={selectedSeason} disabled={Boolean(fetchError || reviewRows.length === 0)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PendingLink
          href={`/admin/schedule?season=${selectedSeason}&filter=sync`}
          className={`rounded-2xl border p-5 shadow-xl transition-colors ${
            activeFilter === 'sync'
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-white/10 bg-card hover:bg-white/[0.03]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-amber-300" />
            Ready to sync
          </div>
          <div className="mt-3 text-3xl font-black italic text-white">{readyUpdates}</div>
          <p className="mt-2 text-sm text-slate-400">Existing rounds with timing changes or source updates.</p>
        </PendingLink>

        <PendingLink
          href={`/admin/schedule?season=${selectedSeason}&filter=add`}
          className={`rounded-2xl border p-5 shadow-xl transition-colors ${
            activeFilter === 'add'
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-white/10 bg-card hover:bg-white/[0.03]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            <PlusCircle className="h-4 w-4 text-emerald-300" />
            Ready to add
          </div>
          <div className="mt-3 text-3xl font-black italic text-white">{readyCreates}</div>
          <p className="mt-2 text-sm text-slate-400">Imported weekends that can be created from an existing circuit match.</p>
        </PendingLink>

        <PendingLink
          href={`/admin/schedule?season=${selectedSeason}&filter=setup`}
          className={`rounded-2xl border p-5 shadow-xl transition-colors ${
            activeFilter === 'setup'
              ? 'border-red-500/30 bg-red-500/10'
              : 'border-white/10 bg-card hover:bg-white/[0.03]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            <CircleAlert className="h-4 w-4 text-red-300" />
            Needs setup
          </div>
          <div className="mt-3 text-3xl font-black italic text-white">{needsMapping}</div>
          <p className="mt-2 text-sm text-slate-400">Imported weekends that still need a circuit inside the app before they can be added.</p>
        </PendingLink>
      </div>

      {fetchError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {fetchError}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black italic tracking-tight text-white">Import preview</h2>
              <p className="mt-1 text-sm text-slate-400">
                {visibleRows.length} of {importedRaces.length} weekends from OpenF1 for {selectedSeason}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PendingLink
                href={`/admin/schedule?season=${selectedSeason}`}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeFilter === 'all'
                    ? 'border-white/15 bg-white/10 text-white'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                All
              </PendingLink>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                <Flag className="h-3.5 w-3.5 text-slate-400" />
                Shared schedule source
              </div>
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-card px-5 py-4 text-sm text-slate-400">
              No weekends match this filter right now.
            </div>
          ) : (
            visibleRows.map((row) => <PreviewCard key={row.imported.meetingKey} row={row} />)
          )}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-card p-5 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
          <Timer className="h-4 w-4 text-red-400" />
          Review rules
        </div>
        <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <p>Imported weekends update FP1, FP2, FP3, qualifying, sprint sessions, race time, and lock time.</p>
          <p>Existing rounds are matched by season + round first, then updated without changing their race status.</p>
          <p>New rounds are only created when the imported weekend has a circuit ready inside the app.</p>
        </div>
      </div>
    </div>
  )
}
