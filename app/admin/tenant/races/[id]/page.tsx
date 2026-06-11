import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { ArrowRight, CheckCircle2, ClipboardCheck, RefreshCw, Trophy, Users } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { getProfileDisplayName } from '@/utils/profile-name'
import { PageBackLink } from '@/components/ui/page-back-link'
import { SectionHeader } from '@/components/ui/section-header'
import { RaceStatusPill } from '@/components/ui/race-status-pill'
import { PendingLink } from '@/components/ui/pending-link'
import {
  TenantBonusPanel,
  type TenantBonusAnswer,
  type TenantBonusConstructorOption,
  type TenantBonusDriverOption,
  type TenantBonusQuestion,
} from '@/app/admin/tenant/tenant-bonus-panel'
import { fetchOpenF1PodiumSuggestion, getOpenF1ErrorMessage } from '@/utils/openf1'

export const revalidate = 0

type TenantRecord = {
  id: string
  name: string
  slug?: string | null
  is_test?: boolean | null
}

type RaceRecord = {
  id: string
  season: number
  round: number
  race_name: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
  external_race_key?: string | null
  circuits?: {
    name?: string | null
    country?: string | null
    emoji?: string | null
  } | null
}

type MemberRecord = {
  id: string
  display_name?: string | null
  email?: string | null
  is_test?: boolean | null
}

type PredictionRecord = {
  user_id: string
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type RaceScoreRecord = {
  user_id: string
  total_points: number
  podium_points: number
  bonus_points: number
  exact_hits: number
}

type DriverRecord = {
  id: string
  code: string
  full_name: string
  emoji?: string | null
  active?: boolean | null
}

type RaceResultRecord = {
  p1_driver_id?: string | null
  p2_driver_id?: string | null
  p3_driver_id?: string | null
  entered_at?: string | null
}

async function refreshTenantRaceOpenF1Preview(formData: FormData) {
  'use server'

  const raceId = String(formData.get('race_id') || '').trim()
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access?.isAdmin || !access.tenantId || !raceId) return

  const { data: race } = await supabase
    .from('races')
    .select('external_race_key')
    .eq('id', raceId)
    .maybeSingle()

  if (race?.external_race_key) {
    revalidateTag(`openf1:meeting:${race.external_race_key}`, { expire: 0 })
  }

  revalidatePath(`/admin/tenant/races/${raceId}`)
}

function getDriverLabel(drivers: DriverRecord[], driverId?: string | null) {
  const driver = drivers.find((entry) => entry.id === driverId)
  if (!driver) return 'Not set'
  return `${driver.code} · ${driver.full_name}`
}

function getRaceStatusCopy(status: RaceStatus) {
  if (status === 'upcoming') return 'Predictions are open. Bonus questions can still be edited.'
  if (status === 'locked') return 'Predictions are locked. Review entries and wait for official results.'
  if (status === 'completed') return 'Official scoring is pending.'
  if (status === 'scored') return 'Scores are published. Bonus answer changes rescore automatically.'
  return 'This race has been cancelled.'
}

export default async function TenantRaceAdminPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { id } = params
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')

  if (!access.isAdmin || !access.tenantId) {
    return <div className="p-20 text-center font-bold text-red-500">Group admin access required.</div>
  }

  const [
    tenantResult,
    raceResult,
    membersResult,
    driversResult,
    constructorsResult,
    officialResult,
    bonusQuestionResult,
  ] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, is_test').eq('id', access.tenantId).maybeSingle(),
    supabase
      .from('races')
      .select('id, season, round, race_name, status, race_start_at, prediction_lock_at, external_race_key, circuits(name, country, emoji)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, display_name, email, is_test')
      .eq('tenant_id', access.tenantId)
      .order('display_name'),
    supabase.from('drivers').select('id, code, full_name, emoji, active').order('full_name'),
    supabase.from('constructors').select('id, name, short_code, emoji').order('name'),
    supabase.from('race_results').select('p1_driver_id, p2_driver_id, p3_driver_id, entered_at').eq('race_id', id).maybeSingle(),
    supabase
      .from('bonus_questions')
      .select('id, race_id, question_text, points, display_order, bonus_options(id, label)')
      .eq('race_id', id)
      .eq('tenant_id', access.tenantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ])

  const typedTenant = (tenantResult.data as TenantRecord | null) ?? null
  const typedRace = (raceResult.data as RaceRecord | null) ?? null

  if (!typedRace) {
    return <div className="p-20 text-center text-slate-400">Race not found.</div>
  }

  const typedMembers = ((membersResult.data || []) as MemberRecord[]).map((member) => ({
    ...member,
    is_test: member.is_test ?? false,
  }))
  const operationalMembers = typedTenant?.is_test
    ? typedMembers
    : typedMembers.filter((member) => !member.is_test)
  const memberIds = operationalMembers.map((member) => member.id)
  const { data: predictions } =
    memberIds.length > 0
      ? await supabase
          .from('predictions')
          .select('user_id, p1_driver_id, p2_driver_id, p3_driver_id')
          .eq('race_id', id)
          .in('user_id', memberIds)
      : { data: [] as PredictionRecord[] }
  const { data: scores } =
    memberIds.length > 0
      ? await supabase
          .from('user_race_scores')
          .select('user_id, total_points, podium_points, bonus_points, exact_hits')
          .eq('race_id', id)
          .in('user_id', memberIds)
      : { data: [] as RaceScoreRecord[] }

  const typedDrivers = (driversResult.data || []) as DriverRecord[]
  const activeDriverOptions = typedDrivers
    .filter((driver) => driver.active !== false)
    .map((driver) => ({
      id: driver.id,
      code: driver.code,
      full_name: driver.full_name,
      emoji: driver.emoji,
    })) satisfies TenantBonusDriverOption[]
  const typedConstructors = (constructorsResult.data || []) as TenantBonusConstructorOption[]
  const typedOfficialResult = (officialResult.data || null) as RaceResultRecord | null
  const typedBonusQuestions = (bonusQuestionResult.data || []) as TenantBonusQuestion[]
  const questionIds = typedBonusQuestions.map((question) => question.id)
  const { data: bonusAnswers } =
    questionIds.length > 0
      ? await supabase
          .from('race_bonus_answers')
          .select('race_id, bonus_question_id, correct_bonus_option_id')
          .in('bonus_question_id', questionIds)
      : { data: [] as TenantBonusAnswer[] }
  const typedBonusAnswers = (bonusAnswers || []) as TenantBonusAnswer[]

  let suggestedPodium = null
  let openF1PodiumError: string | null = null
  if (typedRace.external_race_key && !typedOfficialResult) {
    try {
      suggestedPodium = await fetchOpenF1PodiumSuggestion(typedRace.external_race_key, typedDrivers)
    } catch (error) {
      openF1PodiumError = getOpenF1ErrorMessage(error)
    }
  }

  const effectiveStatus = getEffectiveRaceStatus(typedRace)
  const predictionRows = (predictions || []) as PredictionRecord[]
  const scoreRows = ((scores || []) as RaceScoreRecord[]).sort((left, right) => {
    if (right.total_points !== left.total_points) return right.total_points - left.total_points
    if (right.exact_hits !== left.exact_hits) return right.exact_hits - left.exact_hits
    return left.user_id.localeCompare(right.user_id)
  })
  const predictionUserIds = new Set(predictionRows.map((prediction) => prediction.user_id))
  const missingMembers = operationalMembers.filter((member) => !predictionUserIds.has(member.id))
  const memberById = new Map(operationalMembers.map((member) => [member.id, member]))
  const coveragePercent =
    operationalMembers.length > 0 ? Math.round((predictionUserIds.size / operationalMembers.length) * 100) : 0
  const bonusRace = {
    id: typedRace.id,
    round: typedRace.round,
    race_name: typedRace.race_name,
    effectiveStatus,
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <PageBackLink href="/admin/tenant" label="Back to Group Admin" />
        <SectionHeader
          eyebrow={`Round ${typedRace.round}`}
          title={typedRace.race_name}
          description={`Manage ${typedTenant?.name || 'this group'} entries, results visibility, and bonus scoring for this race.`}
          aside={<RaceStatusPill status={effectiveStatus} />}
        />
      </div>

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl md:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          <span>{predictionUserIds.size}/{operationalMembers.length} entries</span>
          <span className="text-slate-700">/</span>
          <span>{typedBonusQuestions.length} bonus question{typedBonusQuestions.length === 1 ? '' : 's'}</span>
          <span className="text-slate-700">/</span>
          <span>{typedRace.circuits?.name} {typedRace.circuits?.emoji}</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0">
            <div className="text-5xl font-bold leading-none text-white">{coveragePercent}%</div>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-white">Entry coverage</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{getRaceStatusCopy(effectiveStatus)}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <a
              href="#entries"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
            >
              Check entries
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#group-bonus"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
            >
              Bonus scoring
            </a>
          </div>
        </div>
      </section>

      <section id="official-results" className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl md:p-6 scroll-mt-28">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              <Trophy className="h-4 w-4" />
              Official results
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Race winners</h2>
            <p className="mt-1 text-sm text-slate-400">
              Platform admins publish the podium. This view refreshes the saved result and can preview OpenF1 when no result is saved yet.
            </p>
          </div>
          <form action={refreshTenantRaceOpenF1Preview}>
            <input type="hidden" name="race_id" value={typedRace.id} />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-bold text-slate-100 transition-colors hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh source
            </button>
          </form>
        </div>

        {typedOfficialResult ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ['P1', typedOfficialResult.p1_driver_id],
              ['P2', typedOfficialResult.p2_driver_id],
              ['P3', typedOfficialResult.p3_driver_id],
            ].map(([label, driverId]) => (
              <div key={label} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/70">{label}</div>
                <div className="mt-2 font-bold text-white">{getDriverLabel(typedDrivers, driverId)}</div>
              </div>
            ))}
          </div>
        ) : suggestedPodium ? (
          <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="text-sm font-bold text-amber-100">OpenF1 preview, not yet saved by platform admin</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                { label: 'P1', driver: suggestedPodium.p1 },
                { label: 'P2', driver: suggestedPodium.p2 },
                { label: 'P3', driver: suggestedPodium.p3 },
              ].map(({ label, driver }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100/70">{label}</div>
                  <div className="mt-1 font-semibold text-white">
                    {driver ? `${driver.code} · ${driver.fullName}` : 'Not available'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
            {openF1PodiumError || 'No official podium has been saved yet.'}
          </div>
        )}
      </section>

      <section id="entries" className="space-y-4 scroll-mt-28">
        <SectionHeader
          eyebrow="Entries"
          title="Group entries and scores"
          description="Review missing entries before lock and the group result after scoring."
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              <ClipboardCheck className="h-4 w-4" />
              Missing entries
            </div>
            {missingMembers.length === 0 ? (
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">
                Everyone in this group has an entry for this race.
              </div>
            ) : (
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {missingMembers.map((member) => (
                  <div key={member.id} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2">
                    <div className="font-semibold text-slate-100">{getProfileDisplayName(member.display_name, member.email)}</div>
                    <div className="text-xs text-slate-500">{member.email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              <Users className="h-4 w-4" />
              Race standings
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-black/20">
              {scoreRows.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">Scores will appear after official results are saved.</div>
              ) : (
                scoreRows.map((score, index) => {
                  const member = memberById.get(score.user_id)

                  return (
                    <div key={score.user_id} className="grid gap-3 border-b border-white/5 p-4 last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                      <div className="text-lg font-black text-red-400">#{index + 1}</div>
                      <div className="min-w-0">
                        <div className="break-words font-semibold text-white">
                          {getProfileDisplayName(member?.display_name, member?.email)}
                        </div>
                        <div className="text-sm text-slate-500">
                          {score.podium_points} podium · {score.bonus_points} bonus · {score.exact_hits} exact
                        </div>
                      </div>
                      <div className="text-xl font-bold text-white">{score.total_points} pts</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <TenantBonusPanel
        groupName={typedTenant?.name || 'This group'}
        races={[bonusRace]}
        questions={typedBonusQuestions}
        answers={typedBonusAnswers}
        driverOptions={activeDriverOptions}
        constructorOptions={typedConstructors}
        scopeTenantId={access.tenantId}
      />

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Scoped to {typedTenant?.name || 'this group'}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Platform race timing and official podium edits stay with platform admins.
            </p>
          </div>
          <PendingLink
            href="/admin/tenant"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-bold text-slate-100 transition-colors hover:bg-white/10"
          >
            Group admin
            <ArrowRight className="h-4 w-4" />
          </PendingLink>
        </div>
      </section>
    </div>
  )
}
