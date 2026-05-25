import { getCompetitionRank, sortCompetitionStandings, type CompetitionStanding } from '@/utils/competition'
import { escapeHtml, isTransactionalEmailConfigured, renderBrandedEmail, sendTransactionalEmail } from '@/utils/email'
import { formatAmsterdamDateTime } from '@/utils/amsterdam-time'
import { getProfileDisplayName } from '@/utils/profile-name'
import { getAbsoluteUrl } from '@/utils/site'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { isTestModeProfile } from '@/utils/test-mode'

type NotificationKind = 'pre_lock_reminder' | 'score_recap'

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

type LeaderboardStanding = CompetitionStanding & {
  profiles?: { tenant_id?: string | null } | Array<{ tenant_id?: string | null }> | null
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
  return getPositiveNumber(process.env.RACE_REMINDER_LEAD_HOURS, 24)
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
  testRecipient,
  isTestSend,
}: {
  race: NotificationRace
  preference: NotificationPreference
  leadHours: number
  testRecipient?: string | null
  isTestSend?: boolean
}) {
  const profile = getProfile(preference)
  const predictionUrl = getAbsoluteUrl(`/race/${race.id}/predict`)
  const lockLabel = formatRaceDate(race.prediction_lock_at, true)
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
    intro: `Hi ${getProfileDisplayName(profile?.display_name, profile?.email, 'there')}, your entry is still open. Predictions close ${lockLabel}.`,
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
          detail: `This reminder is sent when a race is within ${leadHours} hours of lock and you have not submitted yet.`,
        },
        {
          label: 'Race start',
          value: formatRaceDate(race.race_start_at, true),
        },
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

function renderScoreRecapEmail({
  race,
  preference,
  score,
  movement,
  testRecipient,
  isTestSend,
}: {
  race: NotificationRace
  preference: NotificationPreference
  score: UserRaceScore
  movement: { global: string; group: string }
  testRecipient?: string | null
  isTestSend?: boolean
}) {
  const profile = getProfile(preference)
  const recapUrl = getAbsoluteUrl(`/race/${race.id}#top-scorers`)
  const leaderboardUrl = getAbsoluteUrl('/leaderboard')
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
      { label: 'View race recap', url: recapUrl },
      { label: 'Open standings', url: leaderboardUrl, tone: 'secondary' },
    ],
    unsubscribeUrl: isTestSend ? null : getUnsubscribeUrl(preference),
    bodyHtml:
      testNotice +
      renderInfoGrid([
        {
          label: 'Weekend score',
          value: `${score.total_points} pts`,
          detail: `${score.podium_points} podium pts, ${score.bonus_points} bonus pts, ${score.exact_hits} exact podium hit${score.exact_hits === 1 ? '' : 's'}.`,
        },
        {
          label: 'Overall table',
          value: movement.global,
        },
        {
          label: 'Group table',
          value: movement.group,
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
  const leadHours = getReminderLeadHours()
  const nowIso = now.toISOString()
  const windowEnd = new Date(now.getTime() + leadHours * 60 * 60_000)
  const previewLimit = getPreviewLimit(options)
  const testLimit = getTestLimit(options)
  const isLimitedTestSend = shouldLimitTestSends(options, testRecipient)
  const previews: NotificationPreview[] = []

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
  const preferences = await getNotificationPreferences(supabase, 'pre_lock_reminder', options)
  const preferenceUserIds = preferences.map((preference) => preference.user_id)
  const eventKey = buildEventKey(`pre_lock:${leadHours}h`, options)
  let attempted = 0
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const race of candidateRaces) {
    if (preferenceUserIds.length === 0) continue

    const { data: predictions, error: predictionsError } = await supabase
      .from('predictions')
      .select('user_id')
      .eq('race_id', race.id)
      .in('user_id', preferenceUserIds)

    if (predictionsError) {
      throw new Error(`Failed to load predictions for ${race.race_name}: ${predictionsError.message}`)
    }

    const predictedUserIds = new Set((predictions || []).map((prediction) => prediction.user_id as string))
    const unsubmittedPreferences = preferences.filter(
      (preference) => !predictedUserIds.has(preference.user_id)
    )

    for (const preference of unsubmittedPreferences) {
      if (isLimitedTestSend && attempted >= testLimit) {
        skipped += 1
        continue
      }

      const canClaim = await canClaimNotificationEvent(supabase, {
        userId: preference.user_id,
        raceId: race.id,
        eventKey,
      })

      if (!canClaim) {
        skipped += 1
        continue
      }

      const profile = getProfile(preference)
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
          testRecipient,
          isTestSend: isLimitedTestSend,
        }),
        testRecipient,
        isTestSend: isLimitedTestSend,
        metadata: {
          leadHours,
          predictionLockAt: race.prediction_lock_at,
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
          .select('user_id, total_points, podium_points, bonus_points, exact_hits')
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

    const typedScores = (scores || []) as UserRaceScore[]
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

      if (!canClaim) {
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
