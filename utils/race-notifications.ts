import { getCompetitionRank, sortCompetitionStandings, type CompetitionStanding } from '@/utils/competition'
import { escapeHtml, isTransactionalEmailConfigured, renderBrandedEmail, sendTransactionalEmail } from '@/utils/email'
import { formatAmsterdamDateTime } from '@/utils/amsterdam-time'
import { getProfileDisplayName } from '@/utils/profile-name'
import { getAbsoluteUrl } from '@/utils/site'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { isTestModeProfile } from '@/utils/test-mode'
import {
  getEffectiveNotificationTimingForProfile,
  getEffectiveNotificationTimingForProfiles,
  getFallbackRaceReminderLeadHours,
  type EffectiveNotificationTiming,
} from '@/utils/notification-settings'
import {
  getGroupRaceExperienceWithClient,
  type GroupRaceExperience,
} from '@/utils/group-race-experience'

type NotificationKind = 'pre_lock_reminder' | 'score_recap'

export type ManualLifecycleEmailKind = 'prediction' | 'results'

type ManualLifecycleEmailResult = {
  ok: boolean
  sent: boolean
  message: string
}

type RaceNotificationRunResult = {
  ok: boolean
  notConfigured?: boolean
  mode: 'live' | 'dry-run' | 'test'
  testRecipient?: string
  testUsersOnly?: boolean
  racesChecked: number
  attempted: number
  sent: number
  skipped: number
  failed: number
  message: string
  previews?: NotificationPreview[]
}

export type RaceNotificationRunOptions = {
  dryRun?: boolean
  testRecipient?: string | null
  testRunId?: string
  testLimit?: number
  previewLimit?: number
  testUsersOnly?: boolean
}

type NotificationPreview = {
  eventType: NotificationKind
  eventKey: string
  raceId: string
  raceName: string
  userId: string
  recipientEmail: string
  testRecipient?: string
  testUsersOnly?: boolean
  hasPrediction?: boolean
  totalBonusQuestions?: number
  answeredBonusQuestions?: number
  missingBonusQuestions?: number
  score?: number
}

type NotificationRace = {
  id: string
  season: number
  round: number
  race_name: string
  race_start_at: string
  prediction_lock_at: string
  circuits?: {
    name?: string | null
    country?: string | null
    emoji?: string | null
  } | null
}

type NotificationProfile = {
  id: string
  display_name?: string | null
  email?: string | null
  confirmed_at?: string | null
  is_test?: boolean | null
  tenant_id?: string | null
  tenants?: { is_test?: boolean | null } | Array<{ is_test?: boolean | null }> | null
}

type NotificationPreference = {
  user_id: string
  race_reminder_emails_enabled: boolean
  score_recap_emails_enabled: boolean
  unsubscribe_token: string
  unsubscribed_at?: string | null
  profiles?: NotificationProfile | NotificationProfile[] | null
}

type PredictionReminderCompletion = {
  hasPrediction: boolean
  totalBonusQuestions: number
  answeredBonusQuestions: number
  missingBonusQuestions: number
}

type ClaimedNotificationEvent = {
  id: string
}

type ExistingNotificationEvent = {
  id: string
  status: 'queued' | 'sent' | 'failed'
}

type UserRaceScore = {
  user_id: string
  total_points: number
  podium_points: number
  bonus_points: number
  exact_hits: number
}

type ManualUserRaceScore = UserRaceScore & {
  race_id: string
}

type RaceScoreStanding = UserRaceScore & {
  profiles?: { tenant_id?: string | null } | Array<{ tenant_id?: string | null }> | null
}

type RaceScorePosition = {
  overallRank: number | null
  overallTotal: number
  groupRank: number | null
  groupTotal: number
}

type LeaderboardStanding = CompetitionStanding & {
  profiles?: { tenant_id?: string | null } | Array<{ tenant_id?: string | null }> | null
}

type ReminderPredictionRow = {
  id: string
  user_id: string
}

type ReminderBonusQuestionRow = {
  id: string
  tenant_id?: string | null
  bonus_options?: Array<{ id: string }> | null
}

type ReminderBonusAnswerRow = {
  prediction_id: string
  bonus_question_id: string
}

type NotificationClient = ReturnType<typeof createServiceRoleClient>

function getRelatedOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null
}

function getPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getReminderLeadHours() {
  return getFallbackRaceReminderLeadHours()
}

function getScoreRecapLookbackDays() {
  return getPositiveNumber(process.env.SCORE_RECAP_LOOKBACK_DAYS, 14)
}

function getRunMode(options: RaceNotificationRunOptions = {}): RaceNotificationRunResult['mode'] {
  if (options.dryRun) return 'dry-run'
  if (options.testRecipient || options.testUsersOnly) return 'test'
  return 'live'
}

function getTestRunId(options: RaceNotificationRunOptions) {
  return (options.testRunId || new Date().toISOString()).replace(/[^a-zA-Z0-9_-]/g, '-')
}

function getPreviewLimit(options: RaceNotificationRunOptions) {
  return Math.max(0, Math.min(options.previewLimit ?? 20, 100))
}

function getTestLimit(options: RaceNotificationRunOptions) {
  return Math.max(1, Math.min(options.testLimit ?? 5, 50))
}

function maskEmail(value: string | null | undefined) {
  const email = value?.trim()
  if (!email) return 'missing-email'

  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return 'invalid-email'

  const visible = localPart.length <= 2 ? localPart.slice(0, 1) : localPart.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(localPart.length - visible.length, 2))}@${domain}`
}

function buildEventKey(baseEventKey: string, options: RaceNotificationRunOptions) {
  if (!options.testRecipient && !options.testUsersOnly) return baseEventKey
  return `test:${baseEventKey}:${getTestRunId(options)}`
}

function shouldLimitTestSends(options: RaceNotificationRunOptions, testRecipient: string | null) {
  return !options.dryRun && Boolean(testRecipient || options.testUsersOnly)
}

function buildRunResult(
  partial: Omit<RaceNotificationRunResult, 'ok' | 'message'> & { message?: string }
): RaceNotificationRunResult {
  return {
    ...partial,
    ok: partial.failed === 0,
    message:
      partial.message ||
      `Checked ${partial.racesChecked} race${partial.racesChecked === 1 ? '' : 's'}; sent ${partial.sent}, skipped ${partial.skipped}, failed ${partial.failed}.`,
  }
}

function getProfile(preference: NotificationPreference) {
  return getRelatedOne(preference.profiles)
}

function getTimingProfile(preference: NotificationPreference) {
  const profile = getProfile(preference)

  return {
    user_id: preference.user_id,
    email: profile?.email,
    tenant_id: profile?.tenant_id,
  }
}

function isEligiblePreference(
  preference: NotificationPreference,
  kind: NotificationKind,
  options: RaceNotificationRunOptions = {}
) {
  const profile = getProfile(preference)
  const enabled =
    kind === 'pre_lock_reminder'
      ? preference.race_reminder_emails_enabled
      : preference.score_recap_emails_enabled
  const isTestProfile = isTestModeProfile(profile)

  return Boolean(
    enabled &&
      !preference.unsubscribed_at &&
      profile?.email &&
      profile.confirmed_at &&
      (options.testUsersOnly ? isTestProfile : !isTestProfile)
  )
}

async function getNotificationPreferences(
  supabase: NotificationClient,
  kind: NotificationKind,
  options: RaceNotificationRunOptions = {}
) {
  const enabledColumn =
    kind === 'pre_lock_reminder'
      ? 'race_reminder_emails_enabled'
      : 'score_recap_emails_enabled'

  const { data, error } = await supabase
    .from('notification_preferences')
    .select(
      'user_id, race_reminder_emails_enabled, score_recap_emails_enabled, unsubscribe_token, unsubscribed_at, profiles(id, display_name, email, confirmed_at, is_test, tenant_id, tenants(is_test))'
    )
    .eq(enabledColumn, true)
    .is('unsubscribed_at', null)

  if (error) {
    throw new Error(`Failed to load notification preferences: ${error.message}`)
  }

  return ((data || []) as NotificationPreference[]).filter((preference) =>
    isEligiblePreference(preference, kind, options)
  )
}

async function getExistingNotificationEvent(
  supabase: NotificationClient,
  input: {
    userId: string
    raceId: string
    eventKey: string
  }
): Promise<ExistingNotificationEvent | null> {
  const { data: existing, error: existingError } = await supabase
    .from('notification_events')
    .select('id, status')
    .eq('user_id', input.userId)
    .eq('race_id', input.raceId)
    .eq('event_key', input.eventKey)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to check notification event: ${existingError.message}`)
  }

  return existing as ExistingNotificationEvent | null
}

async function getBlockingLiveNotificationEvent(
  supabase: NotificationClient,
  input: {
    userId: string
    raceId: string
    eventType: NotificationKind
  }
): Promise<ExistingNotificationEvent | null> {
  const { data: existing, error } = await supabase
    .from('notification_events')
    .select('id, status')
    .eq('user_id', input.userId)
    .eq('race_id', input.raceId)
    .eq('event_type', input.eventType)
    .in('status', ['queued', 'sent'])
    .not('event_key', 'like', 'test:%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check notification event: ${error.message}`)
  }

  return existing as ExistingNotificationEvent | null
}

async function canClaimNotificationEvent(
  supabase: NotificationClient,
  input: {
    userId: string
    raceId: string
    eventKey: string
  }
) {
  const existing = await getExistingNotificationEvent(supabase, input)
  return !existing || existing.status === 'failed'
}

async function claimNotificationEvent(
  supabase: NotificationClient,
  input: {
    userId: string
    raceId: string
    eventKey: string
    eventType: NotificationKind
    scheduledFor: string
  }
): Promise<ClaimedNotificationEvent | null> {
  const existing = await getExistingNotificationEvent(supabase, input)

  if (existing) {
    if (existing.status !== 'failed') return null

    const { data, error } = await supabase
      .from('notification_events')
      .update({
        status: 'queued',
        scheduled_for: input.scheduledFor,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to re-queue notification event: ${error.message}`)
    }

    return data as ClaimedNotificationEvent
  }

  const { data, error } = await supabase
    .from('notification_events')
    .insert({
      user_id: input.userId,
      race_id: input.raceId,
      event_key: input.eventKey,
      event_type: input.eventType,
      status: 'queued',
      scheduled_for: input.scheduledFor,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return null
    throw new Error(`Failed to claim notification event: ${error.message}`)
  }

  return data as ClaimedNotificationEvent
}

async function claimManualNotificationEvent(
  supabase: NotificationClient,
  input: {
    userId: string
    raceId: string
    eventKey: string
    eventType: NotificationKind
    scheduledFor: string
    allowDuplicate?: boolean
  }
): Promise<{ event: ClaimedNotificationEvent | null; blockedStatus?: ExistingNotificationEvent['status'] }> {
  const existing = input.allowDuplicate
    ? null
    : await getBlockingLiveNotificationEvent(supabase, input)

  if (input.allowDuplicate) {
    const { data, error } = await supabase
      .from('notification_events')
      .insert({
        user_id: input.userId,
        race_id: input.raceId,
        event_key: `manual:${input.eventKey}:${Date.now()}`,
        event_type: input.eventType,
        status: 'queued',
        scheduled_for: input.scheduledFor,
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to claim override notification event: ${error.message}`)
    }

    return { event: data as ClaimedNotificationEvent }
  }

  if (existing) {
    return { event: null, blockedStatus: existing.status }
  }

  const event = await claimNotificationEvent(supabase, input)
  return { event, blockedStatus: event ? undefined : 'queued' }
}

async function updateNotificationEvent(
  supabase: NotificationClient,
  eventId: string,
  input: {
    status: 'sent' | 'failed'
    recipientEmail?: string | null
    subject?: string
    errorMessage?: string | null
    metadata?: Record<string, unknown>
  }
) {
  const { error } = await supabase
    .from('notification_events')
    .update({
      status: input.status,
      recipient_email: input.recipientEmail || null,
      subject: input.subject || null,
      sent_at: input.status === 'sent' ? new Date().toISOString() : null,
      error_message: input.errorMessage || null,
      metadata: input.metadata || {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (error) {
    throw new Error(`Failed to update notification event: ${error.message}`)
  }
}

function formatRaceDate(value: string, includeZone = false) {
  return formatAmsterdamDateTime(value, { includeZone }) || new Date(value).toLocaleString('en-GB')
}

function getCircuitLabel(race: NotificationRace) {
  const circuit = race.circuits
  if (!circuit?.name && !circuit?.country) return 'Circuit pending'
  return [circuit.name, circuit.country].filter(Boolean).join(', ')
}

function getUnsubscribeUrl(preference: NotificationPreference) {
  return getAbsoluteUrl(`/unsubscribe/${preference.unsubscribe_token}`)
}

async function getNotificationGroupCoverage(
  supabase: NotificationClient,
  tenantId: string | null | undefined,
  raceId: string
) {
  if (!tenantId) return null

  try {
    return await getGroupRaceExperienceWithClient(supabase, tenantId, raceId)
  } catch (error) {
    console.error('Failed to load notification group coverage', error)
    return null
  }
}

function getEmptyReminderCompletion(): PredictionReminderCompletion {
  return {
    hasPrediction: false,
    totalBonusQuestions: 0,
    answeredBonusQuestions: 0,
    missingBonusQuestions: 0,
  }
}

function isReminderComplete(completion: PredictionReminderCompletion) {
  return completion.hasPrediction && completion.missingBonusQuestions === 0
}

function getReminderReasonDetail(completion: PredictionReminderCompletion, leadHours: number) {
  if (completion.hasPrediction && completion.missingBonusQuestions > 0) {
    return `${completion.missingBonusQuestions} bonus call${completion.missingBonusQuestions === 1 ? '' : 's'} still need an answer before lock.`
  }

  return `This reminder is sent when a race is within ${leadHours} hours of lock and your entry is not complete yet.`
}

async function getPredictionReminderCompletions(
  supabase: NotificationClient,
  raceId: string,
  preferences: NotificationPreference[]
) {
  const userIds = preferences.map((preference) => preference.user_id)
  const tenantIds = [
    ...new Set(
      preferences
        .map((preference) => getProfile(preference)?.tenant_id)
        .filter((tenantId): tenantId is string => Boolean(tenantId))
    ),
  ]
  const completionByUserId = new Map<string, PredictionReminderCompletion>(
    userIds.map((userId) => [userId, getEmptyReminderCompletion()])
  )

  if (userIds.length === 0) return completionByUserId

  const { data: predictions, error: predictionsError } = await supabase
    .from('predictions')
    .select('id, user_id')
    .eq('race_id', raceId)
    .in('user_id', userIds)

  if (predictionsError) {
    throw new Error(`Failed to load predictions for reminder completion: ${predictionsError.message}`)
  }

  const predictionRows = (predictions || []) as ReminderPredictionRow[]
  const predictionByUserId = new Map(predictionRows.map((prediction) => [prediction.user_id, prediction]))
  const predictionIds = predictionRows.map((prediction) => prediction.id)
  let bonusQuestions: ReminderBonusQuestionRow[] = []

  if (tenantIds.length > 0) {
    const { data, error } = await supabase
      .from('bonus_questions')
      .select('id, tenant_id, bonus_options(id)')
      .eq('race_id', raceId)
      .eq('is_active', true)
      .in('tenant_id', tenantIds)

    if (error) {
      throw new Error(`Failed to load bonus questions for reminder completion: ${error.message}`)
    }

    bonusQuestions = (data || []) as ReminderBonusQuestionRow[]
  }

  const questionIdsByTenantId = new Map<string, Set<string>>()
  bonusQuestions.forEach((question) => {
    const tenantId = question.tenant_id
    if (!tenantId || !question.bonus_options?.length) return

    const currentQuestionIds = questionIdsByTenantId.get(tenantId) || new Set<string>()
    currentQuestionIds.add(question.id)
    questionIdsByTenantId.set(tenantId, currentQuestionIds)
  })

  const requiredQuestionIds = new Set(
    [...questionIdsByTenantId.values()].flatMap((questionIds) => [...questionIds])
  )
  const answeredQuestionIdsByPredictionId = new Map<string, Set<string>>()

  if (predictionIds.length > 0 && requiredQuestionIds.size > 0) {
    const { data, error } = await supabase
      .from('prediction_bonus_answers')
      .select('prediction_id, bonus_question_id')
      .in('prediction_id', predictionIds)
      .in('bonus_question_id', [...requiredQuestionIds])

    if (error) {
      throw new Error(`Failed to load prediction bonus answers for reminder completion: ${error.message}`)
    }

    ;((data || []) as ReminderBonusAnswerRow[]).forEach((answer) => {
      const currentQuestionIds = answeredQuestionIdsByPredictionId.get(answer.prediction_id) || new Set<string>()
      currentQuestionIds.add(answer.bonus_question_id)
      answeredQuestionIdsByPredictionId.set(answer.prediction_id, currentQuestionIds)
    })
  }

  preferences.forEach((preference) => {
    const profile = getProfile(preference)
    const questionIds = profile?.tenant_id
      ? questionIdsByTenantId.get(profile.tenant_id) || new Set<string>()
      : new Set<string>()
    const prediction = predictionByUserId.get(preference.user_id)
    const answeredQuestionIds = prediction
      ? answeredQuestionIdsByPredictionId.get(prediction.id) || new Set<string>()
      : new Set<string>()
    const answeredBonusQuestions = [...questionIds].filter((questionId) =>
      answeredQuestionIds.has(questionId)
    ).length
    const totalBonusQuestions = questionIds.size

    completionByUserId.set(preference.user_id, {
      hasPrediction: Boolean(prediction),
      totalBonusQuestions,
      answeredBonusQuestions,
      missingBonusQuestions: Math.max(totalBonusQuestions - answeredBonusQuestions, 0),
    })
  })

  return completionByUserId
}

function renderInfoGrid(items: Array<{ label: string; value: string; detail?: string }>) {
  return `
    <div style="margin:22px 0;border:1px solid rgba(148,163,184,0.12);border-radius:18px;background:#111827;padding:16px;">
      ${items
        .map(
          (item) => `
            <div style="padding:12px 0;border-bottom:1px solid rgba(148,163,184,0.08);">
              <div style="margin:0 0 5px;color:#64748b;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(item.label)}</div>
              <div style="color:#f8fafc;font-size:16px;font-weight:800;">${escapeHtml(item.value)}</div>
              ${
                item.detail
                  ? `<div style="margin-top:4px;color:#94a3b8;font-size:13px;line-height:1.5;">${escapeHtml(item.detail)}</div>`
                  : ''
              }
            </div>
          `
        )
        .join('')}
    </div>
  `.trim()
}

function renderPreLockEmail({
  race,
  preference,
  leadHours,
  groupCoverage,
  completion,
  testRecipient,
  isTestSend,
}: {
  race: NotificationRace
  preference: NotificationPreference
  leadHours: number
  groupCoverage?: GroupRaceExperience | null
  completion?: PredictionReminderCompletion
  testRecipient?: string | null
  isTestSend?: boolean
}) {
  const profile = getProfile(preference)
  const predictionUrl = getAbsoluteUrl(`/race/${race.id}/predict`)
  const lockLabel = formatRaceDate(race.prediction_lock_at, true)
  const reminderCompletion = completion || getEmptyReminderCompletion()
  const entrySummary =
    reminderCompletion.hasPrediction && reminderCompletion.totalBonusQuestions > 0
      ? `${reminderCompletion.answeredBonusQuestions}/${reminderCompletion.totalBonusQuestions} bonus answered`
      : reminderCompletion.hasPrediction
        ? 'Podium saved'
        : 'No entry submitted yet'
  const intro =
    reminderCompletion.hasPrediction && reminderCompletion.missingBonusQuestions > 0
      ? `Hi ${getProfileDisplayName(profile?.display_name, profile?.email, 'there')}, your podium is saved, but your bonus calls still need attention. Predictions close ${lockLabel}.`
      : `Hi ${getProfileDisplayName(profile?.display_name, profile?.email, 'there')}, your entry is still open. Predictions close ${lockLabel}.`
  const testNotice = isTestSend
    ? `
      <div style="margin:0 0 18px;border:1px solid rgba(251,191,36,0.2);border-radius:16px;background:rgba(251,191,36,0.08);padding:14px;color:#fde68a;font-size:13px;line-height:1.5;">
        ${
          testRecipient
            ? `Test send to ${escapeHtml(testRecipient)}. Original recipient would be ${escapeHtml(maskEmail(profile?.email))}.`
            : `Test send to this test user's email address (${escapeHtml(maskEmail(profile?.email))}).`
        }
      </div>
    `
    : ''

  return renderBrandedEmail({
    eyebrow: 'Prediction reminder',
    title: `${race.race_name} closes soon`,
    intro,
    actions: [{ label: 'Make my prediction', url: predictionUrl }],
    unsubscribeUrl: isTestSend ? null : getUnsubscribeUrl(preference),
    bodyHtml:
      testNotice +
      renderInfoGrid([
        {
          label: 'Round',
          value: `Round ${race.round}`,
          detail: getCircuitLabel(race),
        },
        {
          label: 'Prediction lock',
          value: lockLabel,
          detail: getReminderReasonDetail(reminderCompletion, leadHours),
        },
        {
          label: 'Entry status',
          value: entrySummary,
          detail: reminderCompletion.hasPrediction
            ? 'Open your picks to finish or update your race entry before the deadline.'
            : 'Pick your podium and answer any available bonus calls before the deadline.',
        },
        {
          label: 'Race start',
          value: formatRaceDate(race.race_start_at, true),
        },
        ...(groupCoverage
          ? [
              {
                label: 'Group grid',
                value: `${groupCoverage.submittedEntries} of ${groupCoverage.totalMembers} entries submitted`,
                detail: 'Picks stay hidden until the deadline.',
              },
            ]
          : []),
      ]),
  })
}

function getStandingProfile(entry: LeaderboardStanding) {
  return getRelatedOne(entry.profiles)
}

function getMovementLabel(currentRank: number | null, previousRank: number | null) {
  if (!currentRank) return 'Not ranked yet'
  if (!previousRank) return `New at #${currentRank}`
  if (currentRank < previousRank) return `Up ${previousRank - currentRank} to #${currentRank}`
  if (currentRank > previousRank) return `Down ${currentRank - previousRank} to #${currentRank}`
  return `Still #${currentRank}`
}

function getScoreMovement({
  userId,
  tenantId,
  currentStandings,
  previousStandings,
}: {
  userId: string
  tenantId?: string | null
  currentStandings: LeaderboardStanding[]
  previousStandings: LeaderboardStanding[]
}) {
  const global = getMovementLabel(
    getCompetitionRank(currentStandings, userId),
    getCompetitionRank(previousStandings, userId)
  )

  if (!tenantId) {
    return { global, group: 'Group rank unavailable' }
  }

  const currentGroup = currentStandings.filter(
    (entry) => getStandingProfile(entry)?.tenant_id === tenantId
  )
  const previousGroup = previousStandings.filter(
    (entry) => getStandingProfile(entry)?.tenant_id === tenantId
  )

  return {
    global,
    group: getMovementLabel(
      getCompetitionRank(currentGroup, userId),
      getCompetitionRank(previousGroup, userId)
    ),
  }
}

function getRaceScoreProfile(entry: RaceScoreStanding) {
  return getRelatedOne(entry.profiles)
}

function sortRaceScoreStandings<T extends UserRaceScore>(scores: T[]) {
  return [...scores].sort((left, right) => {
    if (right.total_points !== left.total_points) return right.total_points - left.total_points
    if (right.exact_hits !== left.exact_hits) return right.exact_hits - left.exact_hits
    if (right.podium_points !== left.podium_points) return right.podium_points - left.podium_points
    if (right.bonus_points !== left.bonus_points) return right.bonus_points - left.bonus_points
    return left.user_id.localeCompare(right.user_id)
  })
}

function getRaceScoreRank(entries: Array<{ user_id: string }>, userId: string) {
  const index = entries.findIndex((entry) => entry.user_id === userId)
  return index >= 0 ? index + 1 : null
}

function getRaceScorePosition({
  userId,
  tenantId,
  scores,
}: {
  userId: string
  tenantId?: string | null
  scores: RaceScoreStanding[]
}): RaceScorePosition {
  const overallStandings = sortRaceScoreStandings(scores)
  const groupStandings = tenantId
    ? sortRaceScoreStandings(
        scores.filter((entry) => getRaceScoreProfile(entry)?.tenant_id === tenantId)
      )
    : []

  return {
    overallRank: getRaceScoreRank(overallStandings, userId),
    overallTotal: overallStandings.length,
    groupRank: tenantId ? getRaceScoreRank(groupStandings, userId) : null,
    groupTotal: groupStandings.length,
  }
}

function formatRank(rank: number | null, total: number) {
  if (!rank || total === 0) return 'Rank pending'
  return `#${rank} of ${total}`
}

function getRaceScoreRankDetail(position: RaceScorePosition) {
  const raceRank = `Race rank ${formatRank(position.overallRank, position.overallTotal)}`
  if (!position.groupRank) return raceRank
  return `${raceRank}; group rank ${formatRank(position.groupRank, position.groupTotal)}`
}

function renderScoreRecapEmail({
  race,
  preference,
  score,
  position,
  movement,
  testRecipient,
  isTestSend,
}: {
  race: NotificationRace
  preference: NotificationPreference
  score: UserRaceScore
  position: RaceScorePosition
  movement?: { global: string; group: string }
  testRecipient?: string | null
  isTestSend?: boolean
}) {
  const profile = getProfile(preference)
  const recapUrl = getAbsoluteUrl(`/race/${race.id}/predict`)
  const leaderboardUrl = getAbsoluteUrl('/leaderboard?view=tenant')
  const testNotice = isTestSend
    ? `
      <div style="margin:0 0 18px;border:1px solid rgba(251,191,36,0.2);border-radius:16px;background:rgba(251,191,36,0.08);padding:14px;color:#fde68a;font-size:13px;line-height:1.5;">
        ${
          testRecipient
            ? `Test send to ${escapeHtml(testRecipient)}. Original recipient would be ${escapeHtml(maskEmail(profile?.email))}.`
            : `Test send to this test user's email address (${escapeHtml(maskEmail(profile?.email))}).`
        }
      </div>
    `
    : ''

  return renderBrandedEmail({
    eyebrow: 'Score recap',
    title: `${score.total_points} pts at ${race.race_name}`,
    intro: `Hi ${getProfileDisplayName(profile?.display_name, profile?.email, 'there')}, the ${race.race_name} scores are published.`,
    actions: [
      { label: 'See my recap', url: recapUrl },
      { label: 'Open standings', url: leaderboardUrl, tone: 'secondary' },
    ],
    unsubscribeUrl: isTestSend ? null : getUnsubscribeUrl(preference),
    bodyHtml:
      testNotice +
      renderInfoGrid([
        {
          label: 'Weekend score',
          value: `${score.total_points} pts`,
          detail: getRaceScoreRankDetail(position),
        },
        ...(movement
          ? [
              {
                label: 'Group table',
                value: movement.group,
                detail: 'Your private standings movement is ready.',
              },
            ]
          : []),
        {
          label: 'Full results',
          value: 'Open your personal recap',
          detail: 'Score breakdown, top scorers, bonus answers, and leaderboard movement are waiting on the site.',
        },
      ]),
  })
}

async function sendClaimedEmail({
  supabase,
  event,
  preference,
  subject,
  htmlContent,
  metadata,
  testRecipient,
  isTestSend,
}: {
  supabase: NotificationClient
  event: ClaimedNotificationEvent
  preference: NotificationPreference
  subject: string
  htmlContent: string
  metadata?: Record<string, unknown>
  testRecipient?: string | null
  isTestSend?: boolean
}) {
  const profile = getProfile(preference)
  const targetEmail = testRecipient || profile?.email
  const targetName = testRecipient ? 'FLORMULA1 test recipient' : profile?.display_name
  const deliveredSubject = isTestSend ? `[TEST] ${subject}` : subject
  const eventMetadata = {
    ...(metadata || {}),
    ...(isTestSend
      ? {
          testRecipient: testRecipient || null,
          testUsersOnly: !testRecipient,
          originalRecipientEmail: profile?.email || null,
        }
      : {}),
  }

  if (!targetEmail) {
    await updateNotificationEvent(supabase, event.id, {
      status: 'failed',
      recipientEmail: null,
      subject: deliveredSubject,
      errorMessage: 'Recipient email is missing.',
      metadata: eventMetadata,
    })
    return false
  }

  try {
    const result = await sendTransactionalEmail({
      to: {
        email: targetEmail,
        name: targetName,
      },
      subject: deliveredSubject,
      htmlContent,
    })

    if (result.status === 'skipped') {
      await updateNotificationEvent(supabase, event.id, {
        status: 'failed',
        recipientEmail: targetEmail,
        subject: deliveredSubject,
        errorMessage: result.reason,
        metadata: eventMetadata,
      })
      return false
    }

    await updateNotificationEvent(supabase, event.id, {
      status: 'sent',
      recipientEmail: targetEmail,
      subject: deliveredSubject,
      metadata: eventMetadata,
    })
    return true
  } catch (error) {
    await updateNotificationEvent(supabase, event.id, {
      status: 'failed',
      recipientEmail: targetEmail,
      subject: deliveredSubject,
      errorMessage: error instanceof Error ? error.message : 'Unknown email error',
      metadata: eventMetadata,
    })
    return false
  }
}

async function getManualNotificationPreference(supabase: NotificationClient, userId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(
      'user_id, race_reminder_emails_enabled, score_recap_emails_enabled, unsubscribe_token, unsubscribed_at, profiles(id, display_name, email, confirmed_at, is_test, tenant_id, tenants(is_test))'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load notification preferences: ${error.message}`)
  }

  return data as NotificationPreference | null
}

function getManualPreferenceBlockReason(
  preference: NotificationPreference | null
) {
  if (!preference) return 'This user has not set email preferences yet.'

  const profile = getProfile(preference)
  const email = profile?.email?.trim()

  if (!email) return 'The selected user does not have an email address.'
  if (!profile?.confirmed_at) return 'The selected user has not confirmed their email address.'
  if (preference.unsubscribed_at) return 'The selected user has unsubscribed from emails.'
  if (!preference.unsubscribe_token) return 'The selected user is missing unsubscribe preferences.'

  return null
}

function getBlockedEventMessage(status: ExistingNotificationEvent['status'] | undefined, raceName: string) {
  if (status === 'sent') return `This email was already sent for ${raceName}. Confirm the override to resend it.`
  if (status === 'queued') return `This email is already waiting to send for ${raceName}. Confirm the override to send another copy.`
  return `This email could not be reserved for ${raceName}. Try again in a moment.`
}

async function sendManualPredictionEmail({
  supabase,
  preference,
  now,
  overrideRules,
}: {
  supabase: NotificationClient
  preference: NotificationPreference
  now: Date
  overrideRules?: boolean
}): Promise<ManualLifecycleEmailResult> {
  if (!preference.race_reminder_emails_enabled && !overrideRules) {
    return {
      ok: false,
      sent: false,
      message: 'Prediction reminders are not enabled for this user. Confirm the override to send anyway.',
    }
  }

  const timing = await getEffectiveNotificationTimingForProfile(supabase, getTimingProfile(preference))
  const leadHours = timing.raceReminderLeadHours
  const nowIso = now.toISOString()
  const windowEnd = new Date(now.getTime() + leadHours * 60 * 60_000)
  const eventKey = buildEventKey('pre_lock', {})

  let racesQuery = supabase
    .from('races')
    .select('id, season, round, race_name, race_start_at, prediction_lock_at, circuits(name, country, emoji)')
    .neq('status', 'cancelled')
    .gt('prediction_lock_at', nowIso)

  if (!overrideRules) {
    racesQuery = racesQuery.lte('prediction_lock_at', windowEnd.toISOString())
  }

  const { data: races, error: racesError } = await racesQuery.order('prediction_lock_at', { ascending: true })

  if (racesError) {
    throw new Error(`Failed to load races for reminders: ${racesError.message}`)
  }

  const candidateRaces = (races || []) as NotificationRace[]
  if (candidateRaces.length === 0) {
    return {
      ok: false,
      sent: false,
      message: overrideRules
        ? 'No upcoming race is available for a prediction reminder.'
        : 'No prediction reminder is due right now. The next race is not inside the reminder window.',
    }
  }

  const completionByRaceId = new Map<string, PredictionReminderCompletion>()
  for (const candidateRace of candidateRaces) {
    const completionByUserId = await getPredictionReminderCompletions(
      supabase,
      candidateRace.id,
      [preference]
    )
    completionByRaceId.set(
      candidateRace.id,
      completionByUserId.get(preference.user_id) || getEmptyReminderCompletion()
    )
  }

  const race = overrideRules
    ? candidateRaces[0]
    : candidateRaces.find((candidateRace) => {
        const completion = completionByRaceId.get(candidateRace.id) || getEmptyReminderCompletion()
        return !isReminderComplete(completion)
      })

  if (!race) {
    return {
      ok: false,
      sent: false,
      message: 'No prediction reminder is due right now. The selected user has completed their podium and bonus calls for races in the reminder window. Confirm the override to send anyway.',
    }
  }

  const completion = completionByRaceId.get(race.id) || getEmptyReminderCompletion()
  const claimed = await claimManualNotificationEvent(supabase, {
    userId: preference.user_id,
    raceId: race.id,
    eventKey,
    eventType: 'pre_lock_reminder',
    scheduledFor: nowIso,
    allowDuplicate: overrideRules,
  })

  if (!claimed.event) {
    return {
      ok: false,
      sent: false,
      message: getBlockedEventMessage(claimed.blockedStatus, race.race_name),
    }
  }

  const subject = `Prediction reminder: ${race.race_name}`
  const profile = getProfile(preference)
  const groupCoverage = await getNotificationGroupCoverage(supabase, profile?.tenant_id, race.id)
  const delivered = await sendClaimedEmail({
    supabase,
    event: claimed.event,
    preference,
    subject,
    htmlContent: renderPreLockEmail({
      race,
      preference,
      leadHours,
      groupCoverage,
      completion,
    }),
    metadata: {
      leadHours,
      leadHoursSource: timing.source,
      predictionLockAt: race.prediction_lock_at,
      hasPrediction: completion.hasPrediction,
      totalBonusQuestions: completion.totalBonusQuestions,
      answeredBonusQuestions: completion.answeredBonusQuestions,
      missingBonusQuestions: completion.missingBonusQuestions,
      manualAdminSend: true,
      manualAdminOverride: Boolean(overrideRules),
    },
  })

  if (!delivered) {
    return {
      ok: false,
      sent: false,
      message: `The prediction reminder for ${race.race_name} could not be sent. Check the delivery log for details.`,
    }
  }

  return {
    ok: true,
    sent: true,
    message: `Sent the prediction reminder for ${race.race_name}.`,
  }
}

async function sendManualResultsEmail({
  supabase,
  preference,
  now,
  overrideRules,
}: {
  supabase: NotificationClient
  preference: NotificationPreference
  now: Date
  overrideRules?: boolean
}): Promise<ManualLifecycleEmailResult> {
  if (!preference.score_recap_emails_enabled && !overrideRules) {
    return {
      ok: false,
      sent: false,
      message: 'Results emails are not enabled for this user. Confirm the override to send anyway.',
    }
  }

  const lookbackDays = getScoreRecapLookbackDays()
  const lookbackStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60_000)
  const eventKey = buildEventKey('score_recap:published', {})

  let racesQuery = supabase
    .from('races')
    .select('id, season, round, race_name, race_start_at, prediction_lock_at, circuits(name, country, emoji)')
    .eq('status', 'scored')

  if (!overrideRules) {
    racesQuery = racesQuery.gte('race_start_at', lookbackStart.toISOString())
  }

  const { data: races, error: racesError } = await racesQuery.order('race_start_at', { ascending: false })

  if (racesError) {
    throw new Error(`Failed to load scored races: ${racesError.message}`)
  }

  const scoredRaces = (races || []) as NotificationRace[]
  if (scoredRaces.length === 0) {
    return {
      ok: false,
      sent: false,
      message: overrideRules
        ? 'No scored race is available for a results email.'
        : 'No results email is due right now. There is no recently scored race in the send window.',
    }
  }

  const { data: userScores, error: userScoresError } = await supabase
    .from('user_race_scores')
    .select('race_id, user_id, total_points, podium_points, bonus_points, exact_hits')
    .eq('user_id', preference.user_id)
    .in(
      'race_id',
      scoredRaces.map((race) => race.id)
    )

  if (userScoresError) {
    throw new Error(`Failed to load the selected user score: ${userScoresError.message}`)
  }

  const userScoreByRaceId = new Map(
    ((userScores || []) as ManualUserRaceScore[]).map((score) => [score.race_id, score])
  )
  const race = scoredRaces.find((scoredRace) => userScoreByRaceId.has(scoredRace.id))
  const score = race ? userScoreByRaceId.get(race.id) || null : null

  if (!race || !score) {
    return {
      ok: false,
      sent: false,
      message: 'No results email is due right now. The selected user does not have a score for a recently scored race.',
    }
  }

  const [{ data: raceScores, error: raceScoresError }, { data: leaderboardRows, error: leaderboardError }] =
    await Promise.all([
      supabase
        .from('user_race_scores')
        .select('user_id, total_points, podium_points, bonus_points, exact_hits, profiles(tenant_id)')
        .eq('race_id', race.id),
      supabase
        .from('leaderboard_cache')
        .select('user_id, total_points, exact_hits, races_scored, profiles(tenant_id)')
        .eq('season', race.season),
    ])

  if (raceScoresError) {
    throw new Error(`Failed to load race scores for ${race.race_name}: ${raceScoresError.message}`)
  }

  if (leaderboardError) {
    throw new Error(`Failed to load leaderboard for ${race.race_name}: ${leaderboardError.message}`)
  }

  const typedRaceScores = (raceScores || []) as RaceScoreStanding[]
  const scoreByUserId = new Map(typedRaceScores.map((raceScore) => [raceScore.user_id, raceScore]))
  const currentStandings = sortCompetitionStandings((leaderboardRows || []) as LeaderboardStanding[])
  const previousStandings = sortCompetitionStandings(
    currentStandings.flatMap((entry) => {
      const raceScore = scoreByUserId.get(entry.user_id)
      const previousEntry: LeaderboardStanding = {
        ...entry,
        total_points: entry.total_points - (raceScore?.total_points || 0),
        exact_hits: entry.exact_hits - (raceScore?.exact_hits || 0),
        races_scored: entry.races_scored - (raceScore ? 1 : 0),
      }

      return previousEntry.races_scored > 0 ? [previousEntry] : []
    })
  )

  const claimed = await claimManualNotificationEvent(supabase, {
    userId: preference.user_id,
    raceId: race.id,
    eventKey,
    eventType: 'score_recap',
    scheduledFor: now.toISOString(),
    allowDuplicate: overrideRules,
  })

  if (!claimed.event) {
    return {
      ok: false,
      sent: false,
      message: getBlockedEventMessage(claimed.blockedStatus, race.race_name),
    }
  }

  const profile = getProfile(preference)
  const movement = getScoreMovement({
    userId: preference.user_id,
    tenantId: profile?.tenant_id,
    currentStandings,
    previousStandings,
  })
  const position = getRaceScorePosition({
    userId: preference.user_id,
    tenantId: profile?.tenant_id,
    scores: typedRaceScores,
  })
  const subject = `${race.race_name} recap: ${score.total_points} pts`
  const delivered = await sendClaimedEmail({
    supabase,
    event: claimed.event,
    preference,
    subject,
    htmlContent: renderScoreRecapEmail({
      race,
      preference,
      score,
      position,
      movement,
    }),
    metadata: {
      totalPoints: score.total_points,
      podiumPoints: score.podium_points,
      bonusPoints: score.bonus_points,
      exactHits: score.exact_hits,
      raceRank: position.overallRank,
      raceRankTotal: position.overallTotal,
      groupRaceRank: position.groupRank,
      groupRaceRankTotal: position.groupTotal,
      globalMovement: movement.global,
      groupMovement: movement.group,
      manualAdminSend: true,
      manualAdminOverride: Boolean(overrideRules),
    },
  })

  if (!delivered) {
    return {
      ok: false,
      sent: false,
      message: `The results email for ${race.race_name} could not be sent. Check the delivery log for details.`,
    }
  }

  return {
    ok: true,
    sent: true,
    message: `Sent the results email for ${race.race_name}.`,
  }
}

export async function sendManualLifecycleEmailForUser({
  userId,
  kind,
  overrideRules = false,
  now = new Date(),
}: {
  userId: string
  kind: ManualLifecycleEmailKind
  overrideRules?: boolean
  now?: Date
}): Promise<ManualLifecycleEmailResult> {
  if (!isTransactionalEmailConfigured()) {
    return {
      ok: false,
      sent: false,
      message: 'Email sending is not ready yet.',
    }
  }

  const supabase = createServiceRoleClient()
  const preference = await getManualNotificationPreference(supabase, userId)
  const blockReason = getManualPreferenceBlockReason(preference)

  if (blockReason || !preference) {
    return {
      ok: false,
      sent: false,
      message: blockReason || 'This user cannot receive the selected email.',
    }
  }

  if (kind === 'prediction') {
    return sendManualPredictionEmail({ supabase, preference, now, overrideRules })
  }

  return sendManualResultsEmail({ supabase, preference, now, overrideRules })
}

export async function runPreLockReminderEmails(
  now = new Date(),
  options: RaceNotificationRunOptions = {}
): Promise<RaceNotificationRunResult> {
  const mode = getRunMode(options)
  const testRecipient = options.testRecipient?.trim() || null

  if (!options.dryRun && !isTransactionalEmailConfigured()) {
    return buildRunResult({
      mode,
      testRecipient: testRecipient || undefined,
      testUsersOnly: options.testUsersOnly || undefined,
      notConfigured: true,
      racesChecked: 0,
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      message: 'Lifecycle email is not configured. Set BREVO_API_KEY and a sender before running reminders.',
    })
  }

  const supabase = createServiceRoleClient()
  const nowIso = now.toISOString()
  const previewLimit = getPreviewLimit(options)
  const testLimit = getTestLimit(options)
  const isLimitedTestSend = shouldLimitTestSends(options, testRecipient)
  const previews: NotificationPreview[] = []
  const preferences = await getNotificationPreferences(supabase, 'pre_lock_reminder', options)
  const preferenceUserIds = preferences.map((preference) => preference.user_id)
  const timingByUserId = await getEffectiveNotificationTimingForProfiles(
    supabase,
    preferences.map(getTimingProfile)
  )
  const maxLeadHours = Math.max(
    getReminderLeadHours(),
    ...[...timingByUserId.values()].map((timing) => timing.raceReminderLeadHours)
  )
  const windowEnd = new Date(now.getTime() + maxLeadHours * 60 * 60_000)

  const { data: races, error: racesError } = await supabase
    .from('races')
    .select('id, season, round, race_name, race_start_at, prediction_lock_at, circuits(name, country, emoji)')
    .neq('status', 'cancelled')
    .gt('prediction_lock_at', nowIso)
    .lte('prediction_lock_at', windowEnd.toISOString())
    .order('prediction_lock_at', { ascending: true })

  if (racesError) {
    throw new Error(`Failed to load races for reminders: ${racesError.message}`)
  }

  const candidateRaces = (races || []) as NotificationRace[]
  let attempted = 0
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const race of candidateRaces) {
    if (preferenceUserIds.length === 0) continue

    const completionByUserId = await getPredictionReminderCompletions(supabase, race.id, preferences)
    const groupCoverageByTenantId = new Map<string, GroupRaceExperience | null>()
    const raceLockTime = new Date(race.prediction_lock_at).getTime()
    const unsubmittedPreferences = preferences.filter((preference) => {
      const completion = completionByUserId.get(preference.user_id) || getEmptyReminderCompletion()
      if (isReminderComplete(completion)) return false

      const timing = timingByUserId.get(preference.user_id)
      const leadHours = timing?.raceReminderLeadHours || getReminderLeadHours()
      const userWindowEnd = now.getTime() + leadHours * 60 * 60_000
      return raceLockTime <= userWindowEnd
    })

    for (const preference of unsubmittedPreferences) {
      const timing = timingByUserId.get(preference.user_id) || {
        raceReminderLeadHours: getReminderLeadHours(),
        source: 'fallback',
      } satisfies EffectiveNotificationTiming
      const leadHours = timing.raceReminderLeadHours
      const eventKey = buildEventKey('pre_lock', options)

      if (isLimitedTestSend && attempted >= testLimit) {
        skipped += 1
        continue
      }

      const canClaim = await canClaimNotificationEvent(supabase, {
        userId: preference.user_id,
        raceId: race.id,
        eventKey,
      })

      const blockingLiveEvent =
        isLimitedTestSend || options.dryRun
          ? null
          : await getBlockingLiveNotificationEvent(supabase, {
              userId: preference.user_id,
              raceId: race.id,
              eventType: 'pre_lock_reminder',
            })

      if (!canClaim || blockingLiveEvent) {
        skipped += 1
        continue
      }

      const profile = getProfile(preference)
      const tenantId = profile?.tenant_id
      let groupCoverage: GroupRaceExperience | null = null
      if (tenantId) {
        if (!groupCoverageByTenantId.has(tenantId)) {
          groupCoverageByTenantId.set(
            tenantId,
            await getNotificationGroupCoverage(supabase, tenantId, race.id)
          )
        }
        groupCoverage = groupCoverageByTenantId.get(tenantId) || null
      }
      const completion = completionByUserId.get(preference.user_id) || getEmptyReminderCompletion()

      if (previews.length < previewLimit) {
        previews.push({
          eventType: 'pre_lock_reminder',
          eventKey,
          raceId: race.id,
          raceName: race.race_name,
          userId: preference.user_id,
          recipientEmail: maskEmail(profile?.email),
          testRecipient: testRecipient || undefined,
          testUsersOnly: options.testUsersOnly || undefined,
          hasPrediction: completion.hasPrediction,
          totalBonusQuestions: completion.totalBonusQuestions,
          answeredBonusQuestions: completion.answeredBonusQuestions,
          missingBonusQuestions: completion.missingBonusQuestions,
        })
      }

      attempted += 1

      if (options.dryRun) {
        continue
      }

      const claimedEvent = await claimNotificationEvent(supabase, {
        userId: preference.user_id,
        raceId: race.id,
        eventKey,
        eventType: 'pre_lock_reminder',
        scheduledFor: nowIso,
      })

      if (!claimedEvent) {
        skipped += 1
        continue
      }

      const subject = `Prediction reminder: ${race.race_name}`
      const delivered = await sendClaimedEmail({
        supabase,
        event: claimedEvent,
        preference,
        subject,
        htmlContent: renderPreLockEmail({
          race,
          preference,
          leadHours,
          groupCoverage,
          completion,
          testRecipient,
          isTestSend: isLimitedTestSend,
        }),
        testRecipient,
        isTestSend: isLimitedTestSend,
        metadata: {
          leadHours,
          leadHoursSource: timing.source,
          predictionLockAt: race.prediction_lock_at,
          hasPrediction: completion.hasPrediction,
          totalBonusQuestions: completion.totalBonusQuestions,
          answeredBonusQuestions: completion.answeredBonusQuestions,
          missingBonusQuestions: completion.missingBonusQuestions,
        },
      })

      if (delivered) sent += 1
      else failed += 1
    }
  }

  return buildRunResult({
    mode,
    testRecipient: testRecipient || undefined,
    testUsersOnly: options.testUsersOnly || undefined,
    racesChecked: candidateRaces.length,
    attempted,
    sent,
    skipped,
    failed,
    previews,
    message: options.dryRun
      ? `Dry run checked ${candidateRaces.length} race${candidateRaces.length === 1 ? '' : 's'}; ${attempted} email${attempted === 1 ? '' : 's'} would be eligible.`
      : undefined,
  })
}

export async function runScoreRecapEmails(
  now = new Date(),
  options: RaceNotificationRunOptions = {}
): Promise<RaceNotificationRunResult> {
  const mode = getRunMode(options)
  const testRecipient = options.testRecipient?.trim() || null

  if (!options.dryRun && !isTransactionalEmailConfigured()) {
    return buildRunResult({
      mode,
      testRecipient: testRecipient || undefined,
      testUsersOnly: options.testUsersOnly || undefined,
      notConfigured: true,
      racesChecked: 0,
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      message: 'Lifecycle email is not configured. Set BREVO_API_KEY and a sender before running recaps.',
    })
  }

  const supabase = createServiceRoleClient()
  const lookbackDays = getScoreRecapLookbackDays()
  const lookbackStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60_000)
  const previewLimit = getPreviewLimit(options)
  const testLimit = getTestLimit(options)
  const isLimitedTestSend = shouldLimitTestSends(options, testRecipient)
  const previews: NotificationPreview[] = []

  const { data: races, error: racesError } = await supabase
    .from('races')
    .select('id, season, round, race_name, race_start_at, prediction_lock_at, circuits(name, country, emoji)')
    .eq('status', 'scored')
    .gte('race_start_at', lookbackStart.toISOString())
    .order('race_start_at', { ascending: false })

  if (racesError) {
    throw new Error(`Failed to load scored races: ${racesError.message}`)
  }

  const scoredRaces = (races || []) as NotificationRace[]
  const preferences = await getNotificationPreferences(supabase, 'score_recap', options)
  const preferencesByUserId = new Map(preferences.map((preference) => [preference.user_id, preference]))
  const eventKey = buildEventKey('score_recap:published', options)
  let attempted = 0
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const race of scoredRaces) {
    const [{ data: scores, error: scoresError }, { data: leaderboardRows, error: leaderboardError }] =
      await Promise.all([
        supabase
          .from('user_race_scores')
          .select('user_id, total_points, podium_points, bonus_points, exact_hits, profiles(tenant_id)')
          .eq('race_id', race.id),
        supabase
          .from('leaderboard_cache')
          .select('user_id, total_points, exact_hits, races_scored, profiles(tenant_id)')
          .eq('season', race.season),
      ])

    if (scoresError) {
      throw new Error(`Failed to load race scores for ${race.race_name}: ${scoresError.message}`)
    }

    if (leaderboardError) {
      throw new Error(`Failed to load leaderboard for ${race.race_name}: ${leaderboardError.message}`)
    }

    const typedScores = (scores || []) as RaceScoreStanding[]
    const scoreByUserId = new Map(typedScores.map((score) => [score.user_id, score]))
    const currentStandings = sortCompetitionStandings((leaderboardRows || []) as LeaderboardStanding[])
    const previousStandings = sortCompetitionStandings(
      currentStandings.flatMap((entry) => {
        const score = scoreByUserId.get(entry.user_id)
        const previousEntry: LeaderboardStanding = {
          ...entry,
          total_points: entry.total_points - (score?.total_points || 0),
          exact_hits: entry.exact_hits - (score?.exact_hits || 0),
          races_scored: entry.races_scored - (score ? 1 : 0),
        }

        return previousEntry.races_scored > 0 ? [previousEntry] : []
      })
    )

    for (const score of typedScores) {
      const preference = preferencesByUserId.get(score.user_id)
      if (!preference) {
        skipped += 1
        continue
      }

      const profile = getProfile(preference)
      if (isLimitedTestSend && attempted >= testLimit) {
        skipped += 1
        continue
      }

      const canClaim = await canClaimNotificationEvent(supabase, {
        userId: preference.user_id,
        raceId: race.id,
        eventKey,
      })

      const blockingLiveEvent =
        isLimitedTestSend || options.dryRun
          ? null
          : await getBlockingLiveNotificationEvent(supabase, {
              userId: preference.user_id,
              raceId: race.id,
              eventType: 'score_recap',
            })

      if (!canClaim || blockingLiveEvent) {
        skipped += 1
        continue
      }

      if (previews.length < previewLimit) {
        previews.push({
          eventType: 'score_recap',
          eventKey,
          raceId: race.id,
          raceName: race.race_name,
          userId: preference.user_id,
          recipientEmail: maskEmail(profile?.email),
          testRecipient: testRecipient || undefined,
          testUsersOnly: options.testUsersOnly || undefined,
          score: score.total_points,
        })
      }

      attempted += 1

      if (options.dryRun) {
        continue
      }

      const claimedEvent = await claimNotificationEvent(supabase, {
        userId: preference.user_id,
        raceId: race.id,
        eventKey,
        eventType: 'score_recap',
        scheduledFor: now.toISOString(),
      })

      if (!claimedEvent) {
        skipped += 1
        continue
      }

      const movement = getScoreMovement({
        userId: score.user_id,
        tenantId: profile?.tenant_id,
        currentStandings,
        previousStandings,
      })
      const position = getRaceScorePosition({
        userId: score.user_id,
        tenantId: profile?.tenant_id,
        scores: typedScores,
      })
      const subject = `${race.race_name} recap: ${score.total_points} pts`
      const delivered = await sendClaimedEmail({
        supabase,
        event: claimedEvent,
        preference,
        subject,
        htmlContent: renderScoreRecapEmail({
          race,
          preference,
          score,
          position,
          movement,
          testRecipient,
          isTestSend: isLimitedTestSend,
        }),
        testRecipient,
        isTestSend: isLimitedTestSend,
        metadata: {
          totalPoints: score.total_points,
          podiumPoints: score.podium_points,
          bonusPoints: score.bonus_points,
          exactHits: score.exact_hits,
          raceRank: position.overallRank,
          raceRankTotal: position.overallTotal,
          groupRaceRank: position.groupRank,
          groupRaceRankTotal: position.groupTotal,
          globalMovement: movement.global,
          groupMovement: movement.group,
        },
      })

      if (delivered) sent += 1
      else failed += 1
    }
  }

  return buildRunResult({
    mode,
    testRecipient: testRecipient || undefined,
    testUsersOnly: options.testUsersOnly || undefined,
    racesChecked: scoredRaces.length,
    attempted,
    sent,
    skipped,
    failed,
    previews,
    message: options.dryRun
      ? `Dry run checked ${scoredRaces.length} scored race${scoredRaces.length === 1 ? '' : 's'}; ${attempted} recap email${attempted === 1 ? '' : 's'} would be eligible.`
      : undefined,
  })
}
