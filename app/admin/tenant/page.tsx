import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarSync,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  HelpCircle,
  MailCheck,
  Trophy,
  XCircle,
} from 'lucide-react'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getCurrentSeason } from '@/utils/season'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { getProfileDisplayName } from '@/utils/profile-name'
import { sortCompetitionStandings } from '@/utils/competition'
import { TenantContextBanner } from '@/components/ui/tenant-context-banner'
import { PendingLink } from '@/components/ui/pending-link'
import { getInvitePath } from '@/utils/group-invites'
import { getAbsoluteUrl } from '@/utils/site'
import { PageBackLink } from '@/components/ui/page-back-link'
import { SectionHeader } from '@/components/ui/section-header'
import { GroupInvitePanel } from './group-invite-panel'
import { GroupRosterPanel } from './group-roster-panel'
import { TenantNotificationTimingPanel } from './notification-timing-panel'
import type { TenantBonusAnswer, TenantBonusQuestion } from './tenant-bonus-panel'
import {
  getPlatformNotificationTiming,
} from '@/utils/notification-settings'
import { formatAmsterdamDateTime } from '@/utils/amsterdam-time'
import { getRaceFocus } from '@/utils/race-focus'
import {
  getTenantRaceActionBadgeClasses,
  getTenantRaceActionLabel,
  getTenantRaceActionPriority,
  getTenantRaceActionState,
  type TenantRaceActionState,
} from '@/utils/admin-race-actions'

export const revalidate = 0

type TenantRecord = {
  id: string
  name: string
  slug: string
  is_test?: boolean | null
}

type TenantMember = {
  id: string
  display_name?: string | null
  email?: string | null
  role: 'user' | 'admin'
  admin_scope?: 'platform' | 'tenant' | null
  tenant_id?: string | null
  is_test?: boolean | null
}

type RaceRecord = {
  id: string
  round: number
  race_name: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
  circuits?: {
    name?: string | null
    country?: string | null
    emoji?: string | null
  } | null
}

type LeaderboardEntry = {
  user_id: string
  total_points: number
  exact_hits: number
  races_scored: number
}

type PredictionEntry = {
  id: string
  user_id: string
  race_id: string
  p1_driver_id?: string | null
  p2_driver_id?: string | null
  p3_driver_id?: string | null
}

type PredictionBonusAnswerEntry = {
  prediction_id: string
  bonus_question_id: string
  bonus_option_id: string
}

type DriverRecord = {
  id: string
  code: string
  full_name: string
  emoji?: string | null
}

type RaceScoreEntry = {
  race_id: string
  user_id: string
  total_points: number
  exact_hits: number
}

type GroupInviteRecord = {
  id: string
  invite_url?: string | null
  share_token?: string | null
  expires_at: string
  max_uses: number
  accepted_count: number
  revoked_at?: string | null
  last_accepted_at?: string | null
  created_at: string
}

type TenantNotificationSettingRow = {
  race_reminder_lead_hours?: number | null
}

type TenantRaceActionRow = {
  race: RaceRecord
  actionState: TenantRaceActionState
  effectiveStatus: RaceStatus
  totalBonusQuestionCount: number
  answeredBonusQuestionCount: number
  pendingBonusQuestionCount: number
}

function getRaceStageLabel(status: RaceStatus) {
  if (status === 'upcoming') return 'Next prediction'
  if (status === 'locked') return 'Weekend live'
  if (status === 'completed') return 'Results pending'
  if (status === 'scored') return 'Scored'
  return 'Cancelled'
}

function getMemberRaceStatus(status: RaceStatus, hasPrediction: boolean) {
  if (hasPrediction && status === 'upcoming') return 'Entered'
  if (hasPrediction && status === 'locked') return 'Locked in'
  if (hasPrediction && status === 'completed') return 'Awaiting score'
  if (hasPrediction && status === 'scored') return 'Scored'
  if (!hasPrediction && status === 'upcoming') return 'Needs entry'
  if (!hasPrediction && status === 'locked') return 'Missed lock'
  if (!hasPrediction && status === 'completed') return 'Missed weekend'
  if (!hasPrediction && status === 'scored') return 'Missed weekend'
  return 'N/A'
}

function isActiveGroupInvite(invite: GroupInviteRecord) {
  if (invite.revoked_at) return false
  if (new Date(invite.expires_at).getTime() <= Date.now()) return false
  return invite.accepted_count < invite.max_uses
}

function getDriverLabel(driver?: DriverRecord | null) {
  if (!driver) return 'Not set'
  return `${driver.code}${driver.emoji ? ` ${driver.emoji}` : ''}`
}

function getTenantActionDescription(
  actionState: TenantRaceActionState | null,
  coveragePercent: number,
  submittedCount: number,
  memberCount: number,
  answeredBonusCount: number,
  totalBonusCount: number
) {
  if (actionState === 'needs_bonus_answers') {
    return `${answeredBonusCount}/${totalBonusCount} bonus answers saved. Group scoring still needs the remaining answer${totalBonusCount - answeredBonusCount === 1 ? '' : 's'}.`
  }

  if (actionState === 'weekend_live') {
    return `${coveragePercent}% submitted. Predictions are locked while the race weekend is live.`
  }

  if (actionState === 'awaiting_results') {
    return `${submittedCount}/${memberCount} entries are in. Official podium publication is still pending.`
  }

  if (actionState === 'race_readiness') {
    return `${coveragePercent}% submitted. Prediction window is still open for this race.`
  }

  return `${submittedCount}/${memberCount} entries were logged. Scores are published and ready for recap.`
}

function getTenantActionButtonLabel(actionState: TenantRaceActionState | null) {
  if (actionState === 'needs_bonus_answers') return 'Open bonus admin'
  return 'Open race admin'
}

function getTenantReviewNote(row: TenantRaceActionRow) {
  if (row.actionState === 'needs_bonus_answers') {
    return `${row.answeredBonusQuestionCount}/${row.totalBonusQuestionCount} bonus answers saved`
  }

  if (row.actionState === 'awaiting_results') {
    return 'Waiting for platform podium publication'
  }

  if (row.actionState === 'weekend_live') {
    return 'Prediction window locked while race is live'
  }

  if (row.actionState === 'race_readiness') {
    return 'Prediction window still open'
  }

  return 'Scored recap available'
}

export default async function TenantAdminPage() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')

  if (!access.isAdmin) {
    return <div className="p-20 text-center text-red-500 font-bold">Admin access required.</div>
  }

  if (!access.tenantId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-8 text-center shadow-2xl">
        <div className="space-y-2">
          <div className="text-sm font-bold uppercase tracking-[0.22em] text-amber-300">Group admin</div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Group assignment required</h1>
          <p className="text-slate-300">
            This admin account needs a group before it can manage invites, members, or entries.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {access.isPlatformAdmin && (
            <PendingLink
              href="/admin/tenants"
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
            >
              Open group setup
            </PendingLink>
          )}
          <PendingLink
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
          >
            View leaderboard
          </PendingLink>
        </div>
      </div>
    )
  }

  const currentSeason = await getCurrentSeason(supabase)

  const tenantWithTest = await supabase
    .from('tenants')
    .select('id, name, slug, is_test')
    .eq('id', access.tenantId)
    .maybeSingle()

  const tenantResult = tenantWithTest.error?.message?.includes('is_test')
    ? await supabase
        .from('tenants')
        .select('id, name, slug')
        .eq('id', access.tenantId)
        .maybeSingle()
    : tenantWithTest

  const membersWithTest = await supabase
    .from('profiles')
    .select('id, display_name, email, role, admin_scope, tenant_id, is_test')
    .eq('tenant_id', access.tenantId)
    .order('display_name')

  const membersResult = membersWithTest.error?.message?.includes('is_test')
    ? await supabase
        .from('profiles')
        .select('id, display_name, email, role, admin_scope, tenant_id')
        .eq('tenant_id', access.tenantId)
        .order('display_name')
    : membersWithTest

  const { data: races } = await supabase
    .from('races')
    .select('id, round, race_name, status, race_start_at, prediction_lock_at, circuits(name, country, emoji)')
    .eq('season', currentSeason)
    .neq('status', 'cancelled')
    .order('race_start_at', { ascending: true })

  const typedTenant = (tenantResult.data as TenantRecord | null) ?? null
  const typedMembers = ((membersResult.data || []) as TenantMember[]).map((member) => ({
    ...member,
    is_test: member.is_test ?? false,
  }))
  const operationalMembers = typedTenant?.is_test
    ? typedMembers
    : typedMembers.filter((member) => !member.is_test)
  const hiddenTestMemberCount = typedMembers.length - operationalMembers.length
  const platformTiming = await getPlatformNotificationTiming(supabase)
  const tenantTimingResult = await supabase
    .from('notification_tenant_settings')
    .select('race_reminder_lead_hours')
    .eq('tenant_id', access.tenantId)
    .maybeSingle()
  const tenantTimingSetting = tenantTimingResult.error?.message?.includes('notification_tenant_settings')
    ? null
    : (tenantTimingResult.data as TenantNotificationSettingRow | null)
  const tenantOverrideLeadHours = tenantTimingSetting?.race_reminder_lead_hours || null
  const defaultTenantLeadHours = tenantOverrideLeadHours || platformTiming.raceReminderLeadHours
  const timingHeading = `${defaultTenantLeadHours}h before prediction lock`
  const timingSummary = tenantOverrideLeadHours
    ? `This group has custom timing. The default is ${platformTiming.raceReminderLeadHours}h.`
    : `This group uses the default timing of ${platformTiming.raceReminderLeadHours}h.`
  const typedRaces = (races || []) as RaceRecord[]
  const memberIds = operationalMembers.map((member) => member.id)
  const seasonRaceIds = typedRaces.map((race) => race.id)

  const { data: tenantBonusQuestions } =
    seasonRaceIds.length > 0
      ? await supabase
          .from('bonus_questions')
          .select('id, race_id, question_text, points, display_order, bonus_options(id, label)')
          .in('race_id', seasonRaceIds)
          .eq('tenant_id', access.tenantId)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
      : { data: [] as TenantBonusQuestion[] }

  const typedTenantBonusQuestions = (tenantBonusQuestions || []) as TenantBonusQuestion[]
  const tenantBonusQuestionIds = typedTenantBonusQuestions.map((question) => question.id)

  const { data: tenantBonusAnswers } =
    tenantBonusQuestionIds.length > 0
      ? await supabase
          .from('race_bonus_answers')
          .select('race_id, bonus_question_id, correct_bonus_option_id')
          .in('bonus_question_id', tenantBonusQuestionIds)
      : { data: [] as TenantBonusAnswer[] }
  const typedTenantBonusAnswers = (tenantBonusAnswers || []) as TenantBonusAnswer[]
  const tenantAnsweredQuestionIds = new Set(
    typedTenantBonusAnswers.map((answer) => answer.bonus_question_id)
  )
  const statusByRaceId = new Map(
    typedRaces.map((race) => [race.id, getEffectiveRaceStatus(race)])
  )
  const bonusQuestionsByRaceId = new Map<string, TenantBonusQuestion[]>()
  typedTenantBonusQuestions.forEach((question) => {
    const current = bonusQuestionsByRaceId.get(question.race_id) || []
    current.push(question)
    bonusQuestionsByRaceId.set(question.race_id, current)
  })
  const answerByQuestionId = new Map(
    typedTenantBonusAnswers.map((answer) => [answer.bonus_question_id, answer.correct_bonus_option_id])
  )
  const pendingTenantBonusAnswerCount = typedTenantBonusQuestions.filter((question) => {
    const status = statusByRaceId.get(question.race_id)
    return status && status !== 'upcoming' && !tenantAnsweredQuestionIds.has(question.id)
  }).length

  const raceFocus = getRaceFocus(typedRaces)
  const tenantRaceActionRows = typedRaces
    .map((race) => {
      const raceQuestions = bonusQuestionsByRaceId.get(race.id) || []
      const effectiveStatus = getEffectiveRaceStatus(race)
      const answeredBonusQuestionCount = raceQuestions.filter((question) => tenantAnsweredQuestionIds.has(question.id)).length
      const pendingBonusQuestionCount = raceQuestions.filter((question) => !tenantAnsweredQuestionIds.has(question.id)).length

      return {
        race,
        actionState: getTenantRaceActionState(race, effectiveStatus === 'upcoming' ? 0 : pendingBonusQuestionCount),
        effectiveStatus,
        totalBonusQuestionCount: raceQuestions.length,
        answeredBonusQuestionCount,
        pendingBonusQuestionCount: effectiveStatus === 'upcoming' ? 0 : pendingBonusQuestionCount,
      } satisfies TenantRaceActionRow
    })
    .sort((left, right) => {
      const priorityDelta =
        getTenantRaceActionPriority(left.actionState) - getTenantRaceActionPriority(right.actionState)
      if (priorityDelta !== 0) return priorityDelta

      if (left.actionState === 'race_readiness' || left.actionState === 'weekend_live') {
        return new Date(left.race.race_start_at).getTime() - new Date(right.race.race_start_at).getTime()
      }

      return new Date(right.race.race_start_at).getTime() - new Date(left.race.race_start_at).getTime()
    })
  const featuredRaceRow = tenantRaceActionRows[0] || null
  const featuredRace = featuredRaceRow?.race || null
  const featuredActionState = featuredRaceRow?.actionState || null
  const featuredRaceReminderAt =
    featuredRace && featuredActionState === 'race_readiness'
      ? new Date(
          new Date(featuredRace.prediction_lock_at).getTime() - defaultTenantLeadHours * 60 * 60 * 1000
        ).toISOString()
      : null
  const featuredRaceAdminHref = featuredRace
    ? `/admin/tenant/races/${featuredRace.id}${featuredActionState === 'needs_bonus_answers' ? '#group-bonus' : ''}`
    : '/season'

  const { data: seasonRacePredictions } =
    seasonRaceIds.length > 0 && memberIds.length > 0
      ? await supabase
          .from('predictions')
          .select('id, user_id, race_id, p1_driver_id, p2_driver_id, p3_driver_id')
          .in('race_id', seasonRaceIds)
          .in('user_id', memberIds)
      : { data: [] as PredictionEntry[] }
  const typedSeasonRacePredictions = (seasonRacePredictions || []) as PredictionEntry[]
  const predictionIds = typedSeasonRacePredictions.map((prediction) => prediction.id)

  const [{ data: drivers }, { data: predictionBonusAnswers }] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, code, full_name, emoji')
      .order('full_name'),
    predictionIds.length > 0
      ? supabase
          .from('prediction_bonus_answers')
          .select('prediction_id, bonus_question_id, bonus_option_id')
          .in('prediction_id', predictionIds)
      : Promise.resolve({ data: [] as PredictionBonusAnswerEntry[] }),
  ])
  const typedDrivers = (drivers || []) as DriverRecord[]
  const typedPredictionBonusAnswers = (predictionBonusAnswers || []) as PredictionBonusAnswerEntry[]

  const { data: seasonRaceScores } =
    seasonRaceIds.length > 0 && memberIds.length > 0
      ? await supabase
          .from('user_race_scores')
          .select('race_id, user_id, total_points, exact_hits')
          .in('race_id', seasonRaceIds)
          .in('user_id', memberIds)
      : { data: [] as RaceScoreEntry[] }

  const { data: leaderboardRows } =
    memberIds.length > 0
      ? await supabase
          .from('leaderboard_cache')
          .select('user_id, total_points, exact_hits, races_scored')
          .eq('season', currentSeason)
          .in('user_id', memberIds)
      : { data: [] as LeaderboardEntry[] }

  const inviteQueryWithToken = await supabase
    .from('group_invites')
    .select('id, share_token, expires_at, max_uses, accepted_count, revoked_at, last_accepted_at, created_at')
    .eq('tenant_id', access.tenantId)
    .order('created_at', { ascending: false })

  const inviteQuery =
    inviteQueryWithToken.error?.message?.includes('share_token')
      ? await supabase
          .from('group_invites')
          .select('id, expires_at, max_uses, accepted_count, revoked_at, last_accepted_at, created_at')
          .eq('tenant_id', access.tenantId)
          .order('created_at', { ascending: false })
      : inviteQueryWithToken

  const inviteSetupMessage = inviteQuery.error
    ? 'Invite links are not ready in this database yet. Run the latest invite update, then come back here.'
    : null
  const inviteMigrationNotice =
    !inviteQuery.error && inviteQueryWithToken.error?.message?.includes('share_token')
      ? 'Older invite links can still work, but this screen can only re-copy links after the latest invite update is applied.'
      : null
  const groupInvites = inviteQuery.error
    ? []
    : ((inviteQuery.data || []) as GroupInviteRecord[]).map((invite) => ({
        ...invite,
        invite_url: invite.share_token ? getAbsoluteUrl(getInvitePath(invite.share_token)) : null,
      }))
  const activeInviteCount = groupInvites.filter(isActiveGroupInvite).length
  const isMainGroup = typedTenant?.slug === 'main'

  const leaderboard = sortCompetitionStandings((leaderboardRows || []) as LeaderboardEntry[])
  const leaderboardByUserId = new Map(leaderboard.map((entry) => [entry.user_id, entry]))
  const memberById = new Map(operationalMembers.map((member) => [member.id, member]))
  const predictionUserIdsByRaceId = new Map<string, Set<string>>()
  for (const entry of typedSeasonRacePredictions) {
    const userIds = predictionUserIdsByRaceId.get(entry.race_id) || new Set<string>()
    userIds.add(entry.user_id)
    predictionUserIdsByRaceId.set(entry.race_id, userIds)
  }
  const scoreRowsByRaceId = new Map<string, RaceScoreEntry[]>()
  for (const entry of (seasonRaceScores || []) as RaceScoreEntry[]) {
    const scoreRows = scoreRowsByRaceId.get(entry.race_id) || []
    scoreRows.push(entry)
    scoreRowsByRaceId.set(entry.race_id, scoreRows)
  }
  for (const [raceId, scoreRows] of scoreRowsByRaceId.entries()) {
    scoreRowsByRaceId.set(
      raceId,
      scoreRows.sort((left, right) => {
        if (right.total_points !== left.total_points) return right.total_points - left.total_points
        if (right.exact_hits !== left.exact_hits) return right.exact_hits - left.exact_hits
        return left.user_id.localeCompare(right.user_id)
      })
    )
  }
  const driverById = new Map(typedDrivers.map((driver) => [driver.id, driver]))
  const predictionByRaceAndUserId = new Map(
    typedSeasonRacePredictions.map((prediction) => [`${prediction.race_id}:${prediction.user_id}`, prediction])
  )
  const bonusOptionLabelById = new Map<string, string>()
  typedTenantBonusQuestions.forEach((question) => {
    question.bonus_options?.forEach((option) => {
      if (option.label) {
        bonusOptionLabelById.set(option.id, option.label)
      }
    })
  })
  const predictionBonusAnswerByPredictionAndQuestionId = new Map(
    typedPredictionBonusAnswers.map((answer) => [
      `${answer.prediction_id}:${answer.bonus_question_id}`,
      answer.bonus_option_id,
    ])
  )
  const nextRacePredictionUserIds =
    featuredRace ? predictionUserIdsByRaceId.get(featuredRace.id) || new Set<string>() : new Set<string>()
  const tenantAdminCount = typedMembers.filter(
    (member) => member.role === 'admin' && member.admin_scope === 'tenant'
  ).length
  const nextRaceCoverage = featuredRace ? nextRacePredictionUserIds.size : 0
  const missingFeaturedRaceMembers = featuredRace
    ? operationalMembers.filter((member) => !nextRacePredictionUserIds.has(member.id))
    : []
  const featuredRaceQuestions = featuredRace ? bonusQuestionsByRaceId.get(featuredRace.id) || [] : []
  const submittedFeaturedRaceMembers = featuredRace
    ? operationalMembers.flatMap((member) => {
        const prediction = predictionByRaceAndUserId.get(`${featuredRace.id}:${member.id}`)
        if (!prediction) return []

        return [{
          member,
          podiumLabels: [
            `P1 ${getDriverLabel(driverById.get(prediction.p1_driver_id || ''))}`,
            `P2 ${getDriverLabel(driverById.get(prediction.p2_driver_id || ''))}`,
            `P3 ${getDriverLabel(driverById.get(prediction.p3_driver_id || ''))}`,
          ],
          bonusLabels: featuredRaceQuestions
            .map((question) => {
              const optionId = predictionBonusAnswerByPredictionAndQuestionId.get(`${prediction.id}:${question.id}`)
              const label = optionId ? bonusOptionLabelById.get(optionId) : null

              return label ? `${question.question_text}: ${label}` : null
            })
            .filter((label): label is string => Boolean(label)),
        }]
      })
    : []
  const featuredPendingBonusQuestions = featuredRaceQuestions.filter(
    (question) => !tenantAnsweredQuestionIds.has(question.id)
  )
  const featuredAnsweredBonusRows = featuredRaceQuestions.flatMap((question) => {
    const optionId = answerByQuestionId.get(question.id)
    const optionLabel = optionId ? question.bonus_options?.find((option) => option.id === optionId)?.label : null
    if (!optionLabel) return []

    return [{
      questionText: question.question_text,
      answerLabel: optionLabel,
    }]
  })
  const showMissingFirst = featuredActionState === 'race_readiness' || featuredActionState === 'weekend_live'
  const coveragePercent =
    featuredRace && operationalMembers.length > 0
      ? Math.round((nextRaceCoverage / operationalMembers.length) * 100)
      : 0
  const tenantRaceRows = tenantRaceActionRows
    .filter((row) =>
      row.race.id !== featuredRace?.id &&
      row.actionState !== 'race_readiness' &&
      row.actionState !== 'scored_review'
    )
    .slice(0, 6)
    .map((row) => {
      const predictionUserIds = predictionUserIdsByRaceId.get(row.race.id) || new Set<string>()
      const scoreRows = scoreRowsByRaceId.get(row.race.id) || []
      const topScore = scoreRows[0] || null
      const topScoreMember = topScore ? memberById.get(topScore.user_id) || null : null

      return {
        ...row,
        entryCount: predictionUserIds.size,
        scoreCount: scoreRows.length,
        topScoreLabel: topScore
          ? `${getProfileDisplayName(topScoreMember?.display_name, topScoreMember?.email)} · ${topScore.total_points} pts`
          : row.actionState === 'awaiting_results'
            ? 'Waiting for platform results'
            : row.actionState === 'needs_bonus_answers'
              ? `${row.answeredBonusQuestionCount}/${row.totalBonusQuestionCount} answers saved`
              : 'Scores not published yet',
      }
    })
  const futureRaceRows = raceFocus.upcomingRaces
    .filter((race) => race.id !== featuredRace?.id)
    .slice(0, 5)
  const featuredEntryOpenItemCount =
    featuredActionState === 'race_readiness' || featuredActionState === 'weekend_live'
      ? missingFeaturedRaceMembers.length
      : 0
  const openItemsCount =
    featuredEntryOpenItemCount +
    (activeInviteCount === 0 ? 1 : 0) +
    pendingTenantBonusAnswerCount
  const pendingBonusRaceId = typedTenantBonusQuestions.find((question) => {
    const status = statusByRaceId.get(question.race_id)
    return status && status !== 'upcoming' && !tenantAnsweredQuestionIds.has(question.id)
  })?.race_id
  const bonusAdminHref =
    pendingBonusRaceId
      ? `/admin/tenant/races/${pendingBonusRaceId}#group-bonus`
      : featuredRace
        ? `/admin/tenant/races/${featuredRace.id}#group-bonus`
        : '#all-race-pages'

  const roster = typedMembers.map((member) => {
    const standing = leaderboardByUserId.get(member.id)
    const featuredRaceStatus = featuredRace ? getEffectiveRaceStatus(featuredRace) : null

    return {
      member,
      standing,
      featuredRaceStatus: featuredRaceStatus
        ? getMemberRaceStatus(featuredRaceStatus, nextRacePredictionUserIds.has(member.id))
        : 'Season complete',
    }
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <PageBackLink
          href={access.isPlatformAdmin ? '/admin' : '/leaderboard?view=tenant'}
          label={access.isPlatformAdmin ? 'Back to Admin' : 'Back to Standings'}
        />
        <SectionHeader
          eyebrow="Group admin"
          title={typedTenant?.name || 'Group operations'}
          description={`Manage invites, members, race entries, bonus questions, and standings for ${typedTenant?.name || 'your group'}.`}
          aside={<Building2 className="h-8 w-8 text-red-500" />}
        />

        <div className="flex flex-wrap items-center gap-3">
          <TenantContextBanner tenantName={typedTenant?.name || null} label="Operating in" />
          {typedTenant?.is_test && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-bold uppercase tracking-wider text-amber-200">
              Test group
            </div>
          )}
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200">
            {access.isPlatformAdmin
              ? 'Viewing this group as a platform admin.'
              : 'Changes apply only to this group.'}
          </div>
          {hiddenTestMemberCount > 0 && !typedTenant?.is_test && (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              Excluding {hiddenTestMemberCount} test account{hiddenTestMemberCount === 1 ? '' : 's'} from health counts.
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Group admin shortcuts">
          {pendingBonusRaceId ? (
            <>
              <PendingLink
                href={bonusAdminHref}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-red-500"
              >
                <HelpCircle className="h-4 w-4" />
                Bonus
              </PendingLink>
              <a
                href="#race-week-ops"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-slate-100 transition-all hover:bg-white/10"
              >
                <ClipboardCheck className="h-4 w-4" />
                Race ops
              </a>
            </>
          ) : (
            <>
              <a
                href="#race-week-ops"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-red-500"
              >
                <ClipboardCheck className="h-4 w-4" />
                Race ops
              </a>
              <PendingLink
                href={bonusAdminHref}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-slate-100 transition-all hover:bg-white/10"
              >
                <HelpCircle className="h-4 w-4" />
                Bonus
              </PendingLink>
            </>
          )}
          <a
            href="#group-invites"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            <MailCheck className="h-4 w-4" />
            Invites
          </a>
          <a
            href="#group-roster"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            <Building2 className="h-4 w-4" />
            Roster
          </a>
          <a
            href="#reminders"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            <CalendarClock className="h-4 w-4" />
            Reminders
          </a>
          <PendingLink
            href="/leaderboard?view=tenant"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            <Trophy className="h-4 w-4" />
            Standings
          </PendingLink>
          <a
            href="#all-race-pages"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            <CalendarSync className="h-4 w-4" />
            All races
          </a>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-xl sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          <span>{openItemsCount} open item{openItemsCount === 1 ? '' : 's'}</span>
          <span className="text-slate-700">/</span>
          <span>{operationalMembers.length} members</span>
          <span className="text-slate-700">/</span>
          <span>Season {currentSeason}</span>
        </div>

        <div className="mt-4">
          <PendingLink
            href={featuredRaceAdminHref}
            className="group block rounded-2xl border border-red-500/20 bg-red-500/10 p-5 transition-colors hover:bg-red-500/14"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-red-100">
              <ClipboardCheck className="h-4 w-4" />
              {featuredActionState === 'needs_bonus_answers' ? 'Bonus answers' : 'Race operations'}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
              <div className="text-5xl font-bold leading-none text-white">
                {featuredRace
                  ? featuredActionState === 'needs_bonus_answers'
                    ? `${featuredRaceRow?.answeredBonusQuestionCount || 0}/${featuredRaceRow?.totalBonusQuestionCount || 0}`
                    : `${nextRaceCoverage}/${operationalMembers.length}`
                  : '0/0'}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {featuredRace ? featuredRace.race_name : 'No race to review'}
                </h2>
                <p className="mt-1 text-sm text-red-100/80">
                  {featuredRace
                    ? getTenantActionDescription(
                        featuredActionState,
                        coveragePercent,
                        nextRaceCoverage,
                        operationalMembers.length,
                        featuredRaceRow?.answeredBonusQuestionCount || 0,
                        featuredRaceRow?.totalBonusQuestionCount || 0
                      )
                    : 'No race is open, live, or waiting on results for this group.'}
                </p>
              </div>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors group-hover:bg-red-500">
              {getTenantActionButtonLabel(featuredActionState)}
              <ArrowRight className="h-4 w-4" />
            </span>
          </PendingLink>
        </div>
      </section>

      <section id="race-week-ops" className="space-y-4 scroll-mt-28">
        <SectionHeader
          eyebrow="Race weekend"
          title="Entries, results, and reminders"
          description="Review the active weekend first, then prepare the next prediction window."
        />

        <div className="space-y-5">
          {featuredRace ? (
            <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">
                    {featuredActionState ? getTenantRaceActionLabel(featuredActionState) : getRaceStageLabel(getEffectiveRaceStatus(featuredRace))}
                  </div>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">{featuredRace.race_name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {featuredActionState === 'needs_bonus_answers' ? (
                      <>
                        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-red-200">
                          {featuredRaceRow?.pendingBonusQuestionCount || 0} pending
                        </span>
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                          {featuredRaceRow?.answeredBonusQuestionCount || 0} answered
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                          {nextRaceCoverage} submitted
                        </span>
                        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-red-200">
                          {missingFeaturedRaceMembers.length} missing
                        </span>
                      </>
                    )}
                    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                      {featuredActionState === 'needs_bonus_answers'
                        ? `${featuredRaceRow?.totalBonusQuestionCount || 0} total`
                        : `${coveragePercent}%`}
                    </span>
                    {featuredRaceReminderAt && (
                      <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                        {formatAmsterdamDateTime(featuredRaceReminderAt, { includeZone: true })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <PendingLink
                    href={`/admin/tenant/races/${featuredRace.id}${featuredActionState === 'needs_bonus_answers' ? '#group-bonus' : ''}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
                  >
                    {getTenantActionButtonLabel(featuredActionState)}
                    <ArrowRight className="h-4 w-4" />
                  </PendingLink>
                  {featuredActionState !== 'needs_bonus_answers' && missingFeaturedRaceMembers.length > 0 && (
                    <a
                      href="#group-invites"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-5 py-3 font-bold text-red-50 transition-colors hover:bg-white/10"
                    >
                      Invites
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {featuredActionState === 'needs_bonus_answers' ? (
                  <>
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/8 p-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200">
                        <XCircle className="h-4 w-4" />
                        Pending answers
                      </div>
                      {featuredPendingBonusQuestions.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">
                          All bonus answers are saved.
                        </div>
                      ) : (
                        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                          {featuredPendingBonusQuestions.map((question) => (
                            <div key={question.id} className="rounded-xl border border-red-500/10 bg-black/25 px-3 py-3">
                              <div className="font-semibold text-slate-100">{question.question_text}</div>
                              <div className="mt-1 text-xs text-red-100/60">
                                Correct answer still needs to be saved for this group.
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                        Saved answers
                      </div>
                      {featuredAnsweredBonusRows.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-400">
                          No answers saved yet.
                        </div>
                      ) : (
                        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                          {featuredAnsweredBonusRows.map((answer) => (
                            <div key={`${answer.questionText}:${answer.answerLabel}`} className="rounded-xl border border-emerald-500/10 bg-black/25 px-3 py-3">
                              <div className="font-semibold text-slate-100">{answer.questionText}</div>
                              <div className="mt-1 text-sm text-emerald-100/75">{answer.answerLabel}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`${showMissingFirst ? 'order-1' : 'order-2'} rounded-2xl border border-red-500/20 bg-red-500/8 p-4 lg:order-none`}>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200">
                        <XCircle className="h-4 w-4" />
                        Missing
                      </div>
                      {missingFeaturedRaceMembers.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">
                          Everyone is in.
                        </div>
                      ) : (
                        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                          {missingFeaturedRaceMembers.map((member) => (
                            <div key={member.id} className="rounded-xl border border-red-500/10 bg-black/25 px-3 py-2">
                              <div className="font-semibold text-slate-100">{getProfileDisplayName(member.display_name, member.email)}</div>
                              <div className="break-all text-xs text-red-100/60">{member.email || 'No email'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={`${showMissingFirst ? 'order-2' : 'order-1'} rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4 lg:order-none`}>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                        Submitted
                      </div>
                      {submittedFeaturedRaceMembers.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-400">
                          No entries yet.
                        </div>
                      ) : (
                        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
                          {submittedFeaturedRaceMembers.map((entry) => (
                            <div key={entry.member.id} className="rounded-xl border border-emerald-500/10 bg-black/25 px-3 py-3">
                              <div className="font-semibold text-slate-100">
                                {getProfileDisplayName(entry.member.display_name, entry.member.email)}
                              </div>
                              <div className="break-all text-xs text-emerald-100/60">{entry.member.email || 'No email'}</div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {entry.podiumLabels.map((label) => (
                                  <span key={label} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-200">
                                    {label}
                                  </span>
                                ))}
                              </div>
                              {entry.bonusLabels.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {entry.bonusLabels.map((label) => (
                                    <div key={label} className="break-words text-xs leading-5 text-emerald-100/75">
                                      {label}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Race weekend</div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">No race to review</h2>
              <p className="mt-2 text-sm text-slate-400">
                When a race opens or locks, entries and missing members will appear here.
              </p>
            </section>
          )}

          <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Race operations</div>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-white">Past races needing review</h2>
              </div>
              <div className="text-sm font-bold text-slate-400">
                {tenantRaceRows.length} race{tenantRaceRows.length === 1 ? '' : 's'}
              </div>
            </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-black/20">
              {tenantRaceRows.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No live races, result waits, or bonus follow-up tasks need review.</div>
              ) : (
                tenantRaceRows.map((row) => (
                  <PendingLink
                    key={row.race.id}
                    href={`/admin/tenant/races/${row.race.id}${row.actionState === 'needs_bonus_answers' ? '#group-bonus' : ''}`}
                    className="group grid min-w-0 gap-3 border-b border-white/5 p-4 transition-colors last:border-b-0 hover:bg-white/[0.03] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                        Round {row.race.round} · {getTenantRaceActionLabel(row.actionState)}
                      </div>
                      <div className="mt-1 break-words text-base font-bold leading-tight text-white">{row.race.race_name}</div>
                      <div className="mt-1 break-words text-sm text-slate-400">
                        {row.entryCount}/{operationalMembers.length} entries · {row.scoreCount} scored member{row.scoreCount === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2 lg:items-end">
                      <div className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${getTenantRaceActionBadgeClasses(row.actionState)}`}>
                        {getTenantRaceActionLabel(row.actionState)}
                      </div>
                      <div className="max-w-full break-words text-sm text-slate-400 lg:text-right">
                        {getTenantReviewNote(row)} · {row.topScoreLabel}
                      </div>
                    </div>
                  </PendingLink>
                ))
              )}
            </div>

            <details className="group mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Future races</div>
                  <div className="mt-1 font-bold text-white">{futureRaceRows.length} upcoming setup page{futureRaceRows.length === 1 ? '' : 's'}</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
              </summary>

              {futureRaceRows.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-slate-500">
                  No future races to prepare.
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-white/5">
                  {futureRaceRows.map((race) => {
                    const raceQuestions = typedTenantBonusQuestions.filter((question) => question.race_id === race.id)

                    return (
                      <PendingLink
                        key={race.id}
                        href={`/admin/tenant/races/${race.id}`}
                        className="group grid min-w-0 gap-3 border-b border-white/5 p-4 transition-colors last:border-b-0 hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                            Round {race.round} · Future setup
                          </div>
                          <div className="mt-1 break-words font-bold text-white">{race.race_name}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {raceQuestions.length} bonus question{raceQuestions.length === 1 ? '' : 's'}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
                      </PendingLink>
                    )
                  })}
                </div>
              )}
            </details>
          </section>

          <div id="reminders" className="scroll-mt-28">
            <TenantNotificationTimingPanel
              groupName={typedTenant?.name || 'This group'}
              currentLeadHoursLabel={timingHeading}
              defaultLeadHours={defaultTenantLeadHours}
              overrideLeadHours={tenantOverrideLeadHours}
              timingSummary={timingSummary}
            />
          </div>
        </div>
      </section>

      <GroupInvitePanel
        groupName={typedTenant?.name || 'your group'}
        invites={groupInvites}
        setupMessage={inviteSetupMessage}
        migrationNotice={inviteMigrationNotice}
      />

      <details id="all-race-pages" className="group border-t border-white/10 pt-5 scroll-mt-28">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="break-words text-xs font-bold uppercase leading-5 tracking-[0.16em] text-slate-500 sm:tracking-[0.22em]">Calendar reference</div>
            <h2 className="mt-1 text-lg font-bold leading-tight text-white">All race detail pages</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Open race admin pages for entries, results visibility, bonus questions, answers, and history.
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
        </summary>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-card shadow-xl">
          {typedRaces.length === 0 ? (
            <div className="p-8 text-center italic text-slate-500">No races available for this season.</div>
          ) : (
            typedRaces.map((race) => {
              const status = getEffectiveRaceStatus(race)
              const raceQuestions = typedTenantBonusQuestions.filter((question) => question.race_id === race.id)
              const answeredCount = raceQuestions.filter((question) => tenantAnsweredQuestionIds.has(question.id)).length

              return (
                <PendingLink
                  href={`/admin/tenant/races/${race.id}`}
                  key={race.id}
                  className="group grid min-w-0 gap-3 border-b border-white/5 p-4 transition-colors last:border-b-0 hover:bg-white/[0.02] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                      Round {race.round} · {getRaceStageLabel(status)}
                    </div>
                    <div className="break-words text-base font-bold leading-tight text-white">{race.race_name}</div>
                    <div className="break-words text-sm text-slate-400">
                      {race.circuits?.name} {race.circuits?.emoji}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 lg:justify-end">
                    <div className="max-w-full rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-left text-[11px] font-bold uppercase leading-4 tracking-[0.14em] text-slate-300 sm:tracking-[0.18em] lg:text-right">
                      {raceQuestions.length === 0
                        ? 'No bonus'
                        : `${answeredCount}/${raceQuestions.length} bonus answers`}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
                  </div>
                </PendingLink>
              )
            })
          )}
        </div>
      </details>

      <GroupRosterPanel
        roster={roster}
        currentUserId={access.userId}
        isMainGroup={isMainGroup}
        tenantAdminCount={tenantAdminCount}
      />

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Group standings</h2>
            <p className="mt-1 text-sm text-slate-400">
              Open the full standings when you need the competitive view.
            </p>
          </div>
          <PendingLink
            href="/leaderboard?view=tenant"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-bold text-slate-100 transition-colors hover:bg-white/10"
          >
            Open standings
            <ArrowRight className="h-4 w-4" />
          </PendingLink>
        </div>
      </section>
    </div>
  )
}
