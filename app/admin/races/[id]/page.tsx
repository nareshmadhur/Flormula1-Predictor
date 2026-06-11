import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, CheckCircle, Calculator, Settings, Users, CalendarSync, ExternalLink, HelpCircle } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import DeleteRaceButton from './delete-button'
import CancelRaceButton from './cancel-button'
import { OfficialResultsForm } from './official-results-form'
import { updateRace } from '@/app/actions/admin'
import { calculateRaceScoresAction } from '@/app/actions/scoring'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { recalculateRaceScores, recalculateRaceScoresIfResultExists } from '@/utils/race-scoring'
import { saveHistoricPrediction, saveOfficialRaceResult } from '@/utils/result-pipeline'
import { getAdminRaceStatusBadgeClasses, getAdminRaceStatusLabel } from '@/utils/admin-race-status'
import {
  buildOpenF1ScheduleReview,
  fetchOpenF1PodiumSuggestion,
  fetchOpenF1SeasonSchedule,
  getOpenF1ErrorMessage,
  type ExistingRaceForImport,
  type OpenF1CircuitLookup,
  type OpenF1ScheduleReviewRow,
} from '@/utils/openf1'
import { ADMIN_TIME_LABEL, formatAmsterdamDateTime, formatAmsterdamInputValue } from '@/utils/amsterdam-time'
import { FormActionButton } from '@/components/ui/form-action-button'
import { PageBackLink } from '@/components/ui/page-back-link'
import { OpenF1RaceSyncForm } from './openf1-race-sync-form'
import { PendingLink } from '@/components/ui/pending-link'
import {
  TenantBonusPanel,
  type TenantBonusAnswer,
  type TenantBonusConstructorOption,
  type TenantBonusDriverOption,
  type TenantBonusQuestion,
} from '@/app/admin/tenant/tenant-bonus-panel'
import { HistoricPredictionForm } from './historic-prediction-form'

export const revalidate = 0

type RaceRecord = {
  id: string
  season: number
  round: number
  race_name: string
  status: 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'
  circuit_id: string
  race_start_at: string
  prediction_lock_at: string
  fp1_at?: string | null
  fp2_at?: string | null
  fp3_at?: string | null
  quali_at?: string | null
  sprint_at?: string | null
  sprint_quali_at?: string | null
  external_race_key?: string | null
}

type DriverRecord = {
  id: string
  code: string
  full_name: string
}

type CircuitRecord = {
  id: string
  name: string
  city?: string | null
  country?: string | null
  emoji?: string | null
}

type RaceResultRecord = {
  p1_driver_id?: string | null
  p2_driver_id?: string | null
  p3_driver_id?: string | null
}

type ProfileRecord = {
  id: string
  display_name?: string | null
  email?: string | null
  tenant_id?: string | null
}

type TenantRecord = {
  id: string
  name: string
  slug?: string | null
  is_test?: boolean | null
}

type PlatformTenantBonusQuestion = TenantBonusQuestion & {
  tenant_id?: string | null
}

async function saveResults(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)
  if (!access?.isPlatformAdmin) return

  const raceId = formData.get('race_id') as string
  const p1 = formData.get('p1_driver_id') as string
  const p2 = formData.get('p2_driver_id') as string
  const p3 = formData.get('p3_driver_id') as string

  await saveOfficialRaceResult(supabase, {
    raceId,
    podium: { p1, p2, p3 },
    bonusAnswers: [],
  })
  await recalculateRaceScoresIfResultExists(supabase, raceId)

  revalidatePath(`/admin/races/${raceId}`)
  revalidatePath('/admin/results')
  revalidatePath('/season')
  revalidatePath('/leaderboard')
  revalidatePath('/predictions')
  revalidatePath('/me/history')
  revalidatePath(`/race/${raceId}`)
  revalidatePath(`/race/${raceId}/predict`)
}

export async function proxyPrediction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)
  if (!access?.isPlatformAdmin) return

  const raceId = formData.get('race_id') as string
  const targetUserId = formData.get('user_id') as string
  const p1 = formData.get('p1') as string
  const p2 = formData.get('p2') as string
  const p3 = formData.get('p3') as string

  if (p1 === p2 || p1 === p3 || p2 === p3) {
      // In production we would return an error toast, but here we just throw or abort
      return
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', targetUserId)
    .maybeSingle()
  const targetTenantId = targetProfile?.tenant_id || null
  const { data: bonusQuestions } = targetTenantId
    ? await supabase
        .from('bonus_questions')
        .select('id, bonus_options(id)')
        .eq('race_id', raceId)
        .eq('tenant_id', targetTenantId)
        .eq('is_active', true)
    : { data: [] }
  const bonusAnswers = ((bonusQuestions || []) as Array<{ id: string; bonus_options?: Array<{ id: string }> | null }>)
    .map((question) => {
      const optionId = String(formData.get(`historic_bonus_${question.id}`) || '').trim()
      if (!optionId) return null

      const validOptionIds = new Set((question.bonus_options || []).map((option) => option.id))
      if (!validOptionIds.has(optionId)) {
        throw new Error('Historic bonus answer does not match the selected user group.')
      }

      return {
        questionId: question.id,
        optionId,
      }
    })
    .filter((answer): answer is { questionId: string; optionId: string } => Boolean(answer))

  const result = await saveHistoricPrediction(supabase, {
    raceId,
    userId: targetUserId,
    podium: { p1, p2, p3 },
    bonusAnswers,
  })

  if (result.shouldRecalculate) {
    await recalculateRaceScores(supabase, raceId)
  }
  
  revalidatePath(`/admin/races/${raceId}`)
  revalidatePath('/season')
  revalidatePath('/leaderboard')
  revalidatePath('/predictions')
  revalidatePath('/me/history')
  revalidatePath(`/race/${raceId}`)
  revalidatePath(`/race/${raceId}/predict`)
}

// Scoring action imported from '@/app/actions/scoring'

export default async function RaceAdminPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params
  
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)
  if (!access) redirect('/login')

  if (!access.isPlatformAdmin) {
    return <div className="p-20 text-center text-red-500 font-bold">Platform admin access required.</div>
  }

  const { data: race } = await supabase.from('races').select('*, circuits(name)').eq('id', id).single()
  if (!race) return <div className="p-20 text-center">Race not found.</div>

  const { data: drivers } = await supabase.from('drivers').select('*').order('full_name')
  const { data: constructors } = await supabase.from('constructors').select('id, name, short_code, emoji').order('name')
  const { data: circuits } = await supabase.from('circuits').select('*').order('name')
  const { data: existingResult } = await supabase.from('race_results').select('*').eq('race_id', id).single()
  const { data: profiles } = await supabase.from('profiles').select('*').order('display_name')
  const { data: tenants } = await supabase.from('tenants').select('id, name, slug, is_test').order('name')
  const { data: tenantBonusQuestions } = await supabase
    .from('bonus_questions')
    .select('id, race_id, tenant_id, question_text, points, display_order, bonus_options(id, label)')
    .eq('race_id', id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const typedRace = race as RaceRecord
  const typedDrivers = (drivers || []) as DriverRecord[]
  const typedConstructors = (constructors || []) as TenantBonusConstructorOption[]
  const typedCircuits = (circuits || []) as CircuitRecord[]
  const typedExistingResult = (existingResult || null) as RaceResultRecord | null
  const typedProfiles = (profiles || []) as ProfileRecord[]
  const typedTenants = (tenants || []) as TenantRecord[]
  const typedTenantBonusQuestions = (tenantBonusQuestions || []) as PlatformTenantBonusQuestion[]
  const tenantBonusQuestionIds = typedTenantBonusQuestions.map((question) => question.id)
  const { data: tenantBonusAnswers } =
    tenantBonusQuestionIds.length > 0
      ? await supabase
          .from('race_bonus_answers')
          .select('race_id, bonus_question_id, correct_bonus_option_id')
          .in('bonus_question_id', tenantBonusQuestionIds)
      : { data: [] as TenantBonusAnswer[] }
  const typedTenantBonusAnswers = (tenantBonusAnswers || []) as TenantBonusAnswer[]
  const effectiveStatus = getEffectiveRaceStatus(typedRace)
  let suggestedPodium = null
  let openF1Review: OpenF1ScheduleReviewRow | null = null
  let openF1PreviewError: string | null = null
  let openF1PodiumError: string | null = null

  if (typedRace.external_race_key) {
    try {
      suggestedPodium = await fetchOpenF1PodiumSuggestion(typedRace.external_race_key, typedDrivers)
    } catch (error) {
      openF1PodiumError = getOpenF1ErrorMessage(error)
      console.error('Failed to load OpenF1 podium suggestion', error)
    }

    try {
      const importedRaces = await fetchOpenF1SeasonSchedule(typedRace.season)
      const importedRace = importedRaces.find(
        (entry) => String(entry.meetingKey) === String(typedRace.external_race_key)
      )

      if (importedRace) {
        openF1Review =
          buildOpenF1ScheduleReview(
            [importedRace],
            [typedRace as ExistingRaceForImport],
            typedCircuits as OpenF1CircuitLookup[]
          )[0] || null
      }
    } catch (error) {
      openF1PreviewError = getOpenF1ErrorMessage(error)
      console.error('Failed to load OpenF1 schedule preview', error)
    }
  }

  function formatReviewValue(label: string, value: string | null) {
    if (!value) return 'Not set'

    if (label === 'Circuit') {
      const circuit = typedCircuits.find((entry) => entry.id === value)
      return circuit ? `${circuit.name}${circuit.emoji ? ` ${circuit.emoji}` : ''}` : value
    }

    if (label === 'Source key') return value

    return formatAmsterdamDateTime(value) || value
  }

  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: predictionsCount } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('race_id', id)
  const setupTasks = [
    {
      href: '#openf1-sync',
      eyebrow: 'Timing',
      title: 'Sync schedule',
      detail: typedRace.external_race_key
        ? 'Refresh FP1, race timing, and OpenF1 details.'
        : 'Link this race through season sync before using one-click refresh.',
    },
    {
      href: '#official-results',
      eyebrow: 'Results',
      title: 'Official results',
      detail: typedExistingResult ? 'Podium is saved and scores refresh automatically.' : 'Save the podium once the race is complete.',
    },
    {
      href: '#group-bonus',
      eyebrow: 'Bonus',
      title: 'Group bonuses',
      detail: 'Review and override tenant bonus questions and answers.',
    },
  ]
  const tenantBonusGroups = typedTenants.map((tenant) => {
    const questionsForTenant = typedTenantBonusQuestions.filter((question) => question.tenant_id === tenant.id)
    const questionIds = new Set(questionsForTenant.map((question) => question.id))

    return {
      tenant,
      questions: questionsForTenant,
      answers: typedTenantBonusAnswers.filter((answer) => questionIds.has(answer.bonus_question_id)),
    }
  })
  const bonusRace = {
    id: typedRace.id,
    round: typedRace.round,
    race_name: typedRace.race_name,
    effectiveStatus,
  }
  const driverOptions = typedDrivers.map((driver) => ({
    id: driver.id,
    code: driver.code,
    full_name: driver.full_name,
  })) satisfies TenantBonusDriverOption[]
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div>
        <PageBackLink href="/admin" label="Back to Admin" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-red-500 font-bold tracking-widest uppercase mb-1">Round {typedRace.round}</div>
            <h1 className="text-3xl font-bold tracking-tight">Manage {typedRace.race_name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${getAdminRaceStatusBadgeClasses(effectiveStatus)}`}>
                Status: {getAdminRaceStatusLabel(effectiveStatus)}
              </span>
              <span className="flex items-center text-sm font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-lg border border-white/5">
                <Users className="w-4 h-4 mr-2 text-slate-400" />
                {predictionsCount} / {totalUsers} Global Predictions
              </span>
            </div>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:justify-end">
            <CancelRaceButton raceId={typedRace.id} raceStatus={typedRace.status} />
            <DeleteRaceButton raceId={typedRace.id} />
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Race setup</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Race setup</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Use these shortcuts for the common tasks on this race.
            </p>
          </div>
          <PendingLink
            href="/admin/results"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10"
          >
            Batch results
          </PendingLink>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Race admin shortcuts">
          {setupTasks.map((task) => (
            <a
              key={task.href}
              href={task.href}
              className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:border-red-500/25 hover:bg-red-500/8"
            >
              {task.title}
            </a>
          ))}
        </div>
      </section>

      <div className="space-y-6">
        
        <div className="space-y-6">
          <div id="openf1-sync" className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl scroll-mt-28">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2 flex items-center">
                  <CalendarSync className="w-5 h-5 mr-2 text-red-500" />
                  Sync from OpenF1
                </h2>
                <p className="text-sm text-slate-400">
                  Start here. OpenF1 is the main source for race timing, race names, and circuit matching.
                  Official results still stay manual, but the podium form below is prefilled whenever OpenF1
                  already has classified results.
                </p>
              </div>

              {openF1Review?.imported.sourceUrl && (
                <a
                  href={openF1Review.imported.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                >
                  Source
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              )}
            </div>

            {openF1Review ? (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
                    Meeting key {openF1Review.imported.meetingKey}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
                    {openF1Review.circuitMatch
                      ? `Circuit match: ${openF1Review.circuitMatch.name}`
                      : 'Circuit match needs review'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
                    Race {formatAmsterdamDateTime(openF1Review.imported.raceStartAt) || 'Not set'}
                  </span>
                </div>

                {openF1Review.fieldChanges.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <div className="text-sm font-bold text-amber-100">Source changes ready to apply</div>
                    <div className="mt-3 grid gap-3">
                      {openF1Review.fieldChanges.map((change) => (
                        <div
                          key={`${change.label}:${change.current}:${change.imported}`}
                          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
                        >
                          <div className="font-semibold text-white">{change.label}</div>
                          <div className="mt-1 grid gap-1 text-slate-300 sm:grid-cols-2">
                            <div>
                              <span className="text-slate-500">Current</span>
                              <div>{formatReviewValue(change.label, change.current)}</div>
                            </div>
                            <div>
                              <span className="text-slate-500">OpenF1</span>
                              <div>{formatReviewValue(change.label, change.imported)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    This weekend is already aligned with the latest OpenF1 schedule snapshot.
                  </div>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    ['FP1', openF1Review.imported.fp1At],
                    ['FP2', openF1Review.imported.fp2At],
                    ['FP3', openF1Review.imported.fp3At],
                    ['Qualifying', openF1Review.imported.qualiAt],
                    ['Sprint Qualifying', openF1Review.imported.sprintQualiAt],
                    ['Sprint', openF1Review.imported.sprintAt],
                  ].map(([label, value]) =>
                    value ? (
                      <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div>
                        <div className="mt-1 font-medium text-white">{formatAmsterdamDateTime(value) || value}</div>
                      </div>
                    ) : null
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                  If OpenF1 has classified race results, the official results form below is already prefilled with
                  the source podium suggestion. Saving still stays manual so you can review before publishing.
                </div>

                <div className="mt-4">
                  <OpenF1RaceSyncForm
                    raceId={typedRace.id}
                    disabled={!typedRace.external_race_key}
                    hasChanges={openF1Review.fieldChanges.length > 0}
                  />
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-300">
                {typedRace.external_race_key && openF1PreviewError ? (
                  <>
                    <div className="font-semibold text-white">OpenF1 is not available for a fresh preview right now.</div>
                    <div>{openF1PreviewError}</div>
                    <div className="flex flex-wrap gap-3">
                      <PendingLink
                        href="/admin/schedule"
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                      >
                        Open season sync
                      </PendingLink>
                      <a
                        href="#manual-schedule"
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                      >
                        Go to manual fallback
                      </a>
                    </div>
                  </>
                ) : typedRace.external_race_key ? (
                  <>
                    <div className="font-semibold text-white">No matching OpenF1 weekend was found for this saved source key right now.</div>
                    <div>
                      This usually means the upstream meeting key changed, the race was linked to the wrong
                      weekend, or OpenF1 has not published the current schedule snapshot yet.
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <PendingLink
                        href="/admin/schedule"
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                      >
                        Open season sync
                      </PendingLink>
                      <a
                        href="#manual-schedule"
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                      >
                        Go to manual fallback
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-white">This weekend does not have an OpenF1 source key yet.</div>
                    <div>Run season sync first so the app can link this weekend to the source, then come back here for one-click refreshes.</div>
                    <div className="flex flex-wrap gap-3">
                      <PendingLink
                        href="/admin/schedule"
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                      >
                        Open season sync
                      </PendingLink>
                      <a
                        href="#manual-schedule"
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                      >
                        Use manual fallback
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Edit Details */}
          <details id="manual-schedule" className="group bg-card border border-amber-500/10 rounded-2xl p-6 shadow-xl scroll-mt-24">
             <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
               <div>
                 <h2 className="text-xl font-bold flex items-center"><Settings className="w-5 h-5 mr-2 text-amber-300" /> Manual schedule edit</h2>
                 <p className="mt-2 text-sm text-slate-400">Open this only when OpenF1 is missing, outdated, or linked to the wrong weekend.</p>
               </div>
               <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-100">
                 Advanced
               </span>
             </summary>
             <div className="mt-6 border-t border-white/10 pt-6">
             <form action={updateRace} className="space-y-4">
               <input type="hidden" name="race_id" value={typedRace.id} />
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Race Name</label>
                  <input name="race_name" defaultValue={typedRace.race_name} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Circuit</label>
                  <select name="circuit_id" defaultValue={typedRace.circuit_id} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2">
                    {typedCircuits.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name} {c.emoji}</option>
                    ))}
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Race Start ({ADMIN_TIME_LABEL})</label>
                  <input name="race_start_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.race_start_at)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
               </div>
               <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">FP1 Start ({ADMIN_TIME_LABEL})</label>
                    <input name="fp1_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.fp1_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">FP2 Start ({ADMIN_TIME_LABEL})</label>
                    <input name="fp2_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.fp2_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">FP3 Start ({ADMIN_TIME_LABEL})</label>
                    <input name="fp3_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.fp3_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Qualifying ({ADMIN_TIME_LABEL})</label>
                    <input name="quali_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.quali_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Sprint Qualifying ({ADMIN_TIME_LABEL})</label>
                    <input name="sprint_quali_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.sprint_quali_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Sprint ({ADMIN_TIME_LABEL})</label>
                    <input name="sprint_at" type="datetime-local" defaultValue={formatAmsterdamInputValue(typedRace.sprint_at)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white dark:[color-scheme:dark]" />
                  </div>
               </div>
               <p className="mt-2 text-xs text-slate-500">Use this only when OpenF1 is missing, outdated, or linked incorrectly. Predictions lock automatically at FP1 - 5m, and manual edits override imported schedule data.</p>
               <FormActionButton idleLabel="Update details" pendingLabel="Saving details..." tone="primary" className="mt-4" />
             </form>
             </div>
          </details>
        </div>

        {/* Results Entry */}
        <div className="space-y-6">

          <div id="official-results" className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl scroll-mt-28">
             <h2 className="text-xl font-bold mb-4 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-red-500" /> Official results</h2>
             <p className="mb-4 text-sm text-slate-400">
               Save the published podium here. Scores recalculate automatically after saving. When OpenF1 has classified results, matching drivers are suggested automatically before you save.
             </p>
             {openF1PodiumError && (
               <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                 {openF1PodiumError} The podium suggestion may be temporarily unavailable, but you can still enter the official result manually below.
               </div>
             )}
             
             <OfficialResultsForm
               raceId={typedRace.id}
               action={saveResults}
               drivers={typedDrivers}
               existingResult={typedExistingResult}
               suggestedPodium={suggestedPodium}
             />
          </div>

          <section id="group-bonus" className="space-y-5 scroll-mt-28">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  <HelpCircle className="h-4 w-4" />
                  Group bonus control
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Tenant bonus questions</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-400">
                  Platform admins can review and override bonus questions and answers for every group on this race.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-bold text-slate-300">
                {typedTenantBonusQuestions.length} question{typedTenantBonusQuestions.length === 1 ? '' : 's'}
              </div>
            </div>

            {tenantBonusGroups.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-card p-6 text-sm text-slate-400">
                Create a group before adding tenant bonus questions.
              </div>
            ) : (
              <div className="grid gap-5">
                {tenantBonusGroups.map(({ tenant, questions, answers }) => (
                  <TenantBonusPanel
                    key={tenant.id}
                    groupName={tenant.name}
                    races={[bonusRace]}
                    questions={questions}
                    answers={answers}
                    driverOptions={driverOptions}
                    constructorOptions={typedConstructors}
                    scopeTenantId={tenant.id}
                    isPlatformScope
                    sectionId={`group-bonus-${tenant.id}`}
                  />
                ))}
              </div>
            )}
          </section>

          <details id="scoring" className="group bg-card border border-amber-500/10 rounded-2xl p-6 shadow-xl scroll-mt-28">
             <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
               <div>
                 <h2 className="text-xl font-bold flex items-center"><Calculator className="w-5 h-5 mr-2 text-amber-300" /> Scoring repair</h2>
                 <p className="mt-2 text-sm text-slate-400">
                   Results and bonus answer saves recalculate automatically. Use this only to repair historic drift.
                 </p>
               </div>
               <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-100">
                 Advanced
               </span>
             </summary>

             <form action={calculateRaceScoresAction} className="mt-6 border-t border-white/10 pt-6">
                <input type="hidden" name="race_id" value={typedRace.id} />
                <FormActionButton
                  idleLabel={typedExistingResult ? 'Repair scores' : 'Save results first'}
                  pendingLabel="Repairing scores..."
                  tone="light"
                  disabled={!typedExistingResult}
                  className="disabled:opacity-50"
                />
             </form>
          </details>

          {/* Proxy Prediction Form */}
          <details className="group bg-card border border-amber-500/10 rounded-2xl p-6 shadow-xl">
             <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
               <div>
                 <h2 className="text-xl font-bold flex items-center"><Plus className="w-5 h-5 mr-2 text-amber-300" /> Log historic prediction</h2>
	                 <p className="mt-2 text-sm text-slate-400">Use this for backfills or corrections, not normal race-week submissions. Saved official races are rescored automatically.</p>
               </div>
               <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-100">
                 Advanced
               </span>
             </summary>
             <div className="mt-6 border-t border-white/10 pt-6">
               <HistoricPredictionForm
                 raceId={typedRace.id}
                 action={proxyPrediction}
                 profiles={typedProfiles}
                 drivers={typedDrivers}
                 bonusQuestions={typedTenantBonusQuestions}
               />
             </div>
          </details>
        </div>

      </div>
    </div>
  )
}
