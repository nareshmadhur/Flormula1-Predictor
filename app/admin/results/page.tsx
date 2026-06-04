import { ClipboardCheck, Flag, RefreshCcw, Trophy } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { PageBackLink } from '@/components/ui/page-back-link'
import { SectionHeader } from '@/components/ui/section-header'
import { PendingLink } from '@/components/ui/pending-link'
import { BatchResultsForm } from './batch-results-form'

export const revalidate = 0

type RaceRow = {
  id: string
  season: number
  round: number
  race_name: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
}

type DriverRow = {
  id: string
  code: string
  full_name: string
}

type BonusOptionRow = {
  id: string
  label?: string | null
}

type BonusQuestionRow = {
  id: string
  race_id: string
  question_text: string
  points: number
  bonus_options?: BonusOptionRow[]
}

type RaceResultRow = {
  race_id: string
  p1_driver_id?: string | null
  p2_driver_id?: string | null
  p3_driver_id?: string | null
}

type RaceBonusAnswerRow = {
  race_id: string
  bonus_question_id: string
  correct_bonus_option_id: string
}

export default async function AdminResultsPage() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')
  if (access.isTenantAdmin) redirect('/admin/tenant')

  if (!access.isPlatformAdmin) {
    return (
      <div className="p-20 text-center font-bold text-red-500">
        Platform admin access required.
      </div>
    )
  }

  const [{ data: races }, { data: drivers }] = await Promise.all([
    supabase
      .from('races')
      .select('id, season, round, race_name, status, race_start_at, prediction_lock_at')
      .order('round', { ascending: false }),
    supabase.from('drivers').select('id, code, full_name').order('full_name'),
  ])

  const typedRaces = (races || []) as RaceRow[]
  const eligibleRaces = typedRaces.filter((race) => {
    const effectiveStatus = getEffectiveRaceStatus(race)
    return effectiveStatus === 'completed' || effectiveStatus === 'scored'
  })

  const eligibleRaceIds = eligibleRaces.map((race) => race.id)
  const [resultsResponse, questionsResponse, answersResponse] =
    eligibleRaceIds.length > 0
      ? await Promise.all([
          supabase
            .from('race_results')
            .select('race_id, p1_driver_id, p2_driver_id, p3_driver_id')
            .in('race_id', eligibleRaceIds),
          supabase
            .from('bonus_questions')
            .select('id, race_id, question_text, points, bonus_options(id, label)')
            .in('race_id', eligibleRaceIds)
            .is('tenant_id', null)
            .eq('is_active', true)
            .order('points', { ascending: false }),
          supabase
            .from('race_bonus_answers')
            .select('race_id, bonus_question_id, correct_bonus_option_id')
            .in('race_id', eligibleRaceIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }]

  const resultsByRace = new Map(
    ((resultsResponse.data || []) as RaceResultRow[]).map((result) => [result.race_id, result])
  )
  const bonusQuestionsByRace = new Map<string, BonusQuestionRow[]>()
  const bonusAnswersByRace = new Map<string, RaceBonusAnswerRow[]>()

  for (const question of (questionsResponse.data || []) as BonusQuestionRow[]) {
    const current = bonusQuestionsByRace.get(question.race_id) || []
    current.push(question)
    bonusQuestionsByRace.set(question.race_id, current)
  }

  for (const answer of (answersResponse.data || []) as RaceBonusAnswerRow[]) {
    const current = bonusAnswersByRace.get(answer.race_id) || []
    current.push(answer)
    bonusAnswersByRace.set(answer.race_id, current)
  }

  const batchRaces = eligibleRaces.map((race) => {
    const existingResult = resultsByRace.get(race.id) || null
    const effectiveStatus = getEffectiveRaceStatus(race)

    return {
      id: race.id,
      season: race.season,
      round: race.round,
      race_name: race.race_name,
      effectiveStatus,
      hasExistingResult: Boolean(existingResult),
      selectedByDefault: !existingResult || effectiveStatus === 'completed',
      bonusQuestions: bonusQuestionsByRace.get(race.id) || [],
      existingResult,
      existingBonusAnswers: bonusAnswersByRace.get(race.id) || [],
    }
  })

  const pendingResultsCount = batchRaces.filter((race) => !race.hasExistingResult).length
  const readyToRescoreCount = batchRaces.filter(
    (race) => race.hasExistingResult && race.effectiveStatus === 'completed'
  ).length
  const scoredCount = batchRaces.filter((race) => race.effectiveStatus === 'scored').length

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <PageBackLink href="/admin" label="Back to Admin" />
        <SectionHeader
          eyebrow="Admin"
          title="Results desk"
          description="Save official podiums and bonus answers across multiple weekends without hopping through one race at a time."
          aside={<ClipboardCheck className="h-8 w-8 text-red-500" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-red-100">Need results</div>
          <div className="mt-3 text-3xl font-black italic text-white">{pendingResultsCount}</div>
          <p className="mt-2 text-sm text-red-100/80">Weekends still waiting for an official podium save.</p>
        </div>

        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-amber-100">Needs scoring</div>
          <div className="mt-3 text-3xl font-black italic text-white">{readyToRescoreCount}</div>
          <p className="mt-2 text-sm text-amber-100/80">Saved results that are ready for a scoring rerun.</p>
        </div>

        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-100">Already scored</div>
          <div className="mt-3 text-3xl font-black italic text-white">{scoredCount}</div>
          <p className="mt-2 text-sm text-emerald-100/80">Published weekends you can still correct if needed.</p>
        </div>
      </div>

      {batchRaces.length > 0 ? (
        <BatchResultsForm races={batchRaces} drivers={(drivers || []) as DriverRow[]} />
      ) : (
        <div className="rounded-3xl border border-white/10 bg-card p-8 shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-300">
                <Flag className="h-3.5 w-3.5 text-red-400" />
                Nothing to publish right now
              </div>
              <h2 className="text-2xl font-black italic tracking-tight text-white">
                Official results will appear here after a weekend ends.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                When a weekend moves past race start, this desk becomes the fastest way to save the podium and
                bonus answers. Until then, schedule sync and race setup live in the control room.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PendingLink
                href="/admin/schedule"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Open schedule sync
              </PendingLink>
              <PendingLink
                href="/season"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
              >
                <Trophy className="mr-2 h-4 w-4" />
                Open season page
              </PendingLink>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
