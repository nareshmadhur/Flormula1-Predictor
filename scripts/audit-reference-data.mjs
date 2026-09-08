import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })

const OPEN_F1_API_BASE = 'https://api.openf1.org/v1'
const PAGE_SIZE = 1000

const TABLES_TO_COUNT = [
  'profiles',
  'tenants',
  'constructors',
  'drivers',
  'circuits',
  'races',
  'bonus_questions',
  'bonus_options',
  'predictions',
  'prediction_bonus_answers',
  'race_results',
  'race_bonus_answers',
  'user_race_scores',
  'leaderboard_cache',
  'group_invites',
  'group_invite_acceptances',
  'group_requests',
  'notification_preferences',
  'notification_events',
  'notification_platform_settings',
  'notification_tenant_settings',
  'official_result_audit',
  'historic_prediction_audit',
  'tenant_bonus_answer_audit',
]

const TEAM_ALIASES = {
  McLaren: ['mclaren'],
  'Red Bull Racing': ['red bull racing', 'red bull', 'oracle red bull'],
  Audi: ['audi', 'sauber', 'stake', 'stake sauber'],
  Alpine: ['alpine'],
  Cadillac: ['cadillac'],
  Mercedes: ['mercedes', 'mercedes amg', 'mercedes-amg'],
  'Aston Martin': ['aston martin', 'aston martin aramco'],
  Ferrari: ['ferrari', 'scuderia ferrari'],
  Williams: ['williams'],
  'Racing Bulls': ['racing bulls', 'rb', 'visa cash app rb', 'visa cash app racing bulls'],
  'Haas F1 Team': ['haas', 'haas f1 team'],
}

const args = parseArgs(process.argv.slice(2))
const season = Number(args.season || new Date().getFullYear())
const includeOpenF1 = Boolean(args.openf1)
const outputJson = Boolean(args.json)
const failOn = args['fail-on'] || 'never'

function parseArgs(rawArgs) {
  const parsed = {}

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]

    if (!arg.startsWith('--')) continue

    const [rawKey, inlineValue] = arg.slice(2).split('=')
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue
      continue
    }

    const next = rawArgs[index + 1]
    if (next && !next.startsWith('--')) {
      parsed[rawKey] = next
      index += 1
      continue
    }

    parsed[rawKey] = true
  }

  return parsed
}

function normalizeText(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeConstructorName(value) {
  return normalizeText(value)
    .replace(/\bf1\b/g, '')
    .replace(/\bteam\b/g, '')
    .replace(/\bracing\b/g, '')
    .replace(/\bformula one\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCode(value) {
  return (value || '').trim().toUpperCase()
}

function keyForCircuit(circuit) {
  return [circuit.name, circuit.city, circuit.country].map(normalizeText).join('::')
}

function mapById(rows) {
  return new Map(rows.map((row) => [row.id, row]))
}

function groupBy(rows, getKey) {
  const groups = new Map()

  for (const row of rows) {
    const key = getKey(row)
    if (!key) continue
    const group = groups.get(key) || []
    group.push(row)
    groups.set(key, group)
  }

  return groups
}

function compactRow(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, row?.[field] ?? null]))
}

function addIssue(issues, severity, area, title, detail, rows = []) {
  issues.push({
    severity,
    area,
    title,
    detail,
    rows,
  })
}

function addDuplicateIssues(issues, area, title, rows, getKey, fields, severity = 'warning') {
  const duplicates = [...groupBy(rows, getKey).entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      rows: group.map((row) => compactRow(row, fields)),
    }))

  if (duplicates.length === 0) return

  addIssue(
    issues,
    severity,
    area,
    title,
    `${duplicates.length} duplicate key${duplicates.length === 1 ? '' : 's'} found.`,
    duplicates
  )
}

async function selectAll(supabase, table, columns, orderColumn = 'id') {
  const rows = []
  let from = 0

  while (true) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1)
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true })
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to load ${table}: ${error.message}`)
    }

    rows.push(...(data || []))

    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function countRows(supabase, table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })

  if (error) {
    return { table, count: null, error: error.message }
  }

  return { table, count: count || 0, error: null }
}

async function fetchOpenF1Json(path) {
  const response = await fetch(`${OPEN_F1_API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`OpenF1 ${path} failed with ${response.status}`)
  }

  return response.json()
}

function getCanonicalTeamName(teamName) {
  const normalized = normalizeText(teamName)

  for (const [canonicalName, aliases] of Object.entries(TEAM_ALIASES)) {
    if (aliases.some((alias) => normalizeText(alias) === normalized)) {
      return canonicalName
    }
  }

  return teamName
}

function getOpenF1DriverName(driver) {
  if (driver.full_name) return driver.full_name
  return [driver.first_name, driver.last_name].filter(Boolean).join(' ') || driver.broadcast_name || driver.name_acronym
}

async function fetchOpenF1SeasonDrivers(seasonYear) {
  const sessions = await fetchOpenF1Json(`/sessions?year=${seasonYear}&session_name=Race`)

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {
      source: 'OpenF1 race sessions',
      warning: `No OpenF1 race sessions found for ${seasonYear}.`,
      drivers: [],
    }
  }

  const now = Date.now()
  const raceSessions = [...sessions].sort(
    (left, right) => new Date(right.date_start).getTime() - new Date(left.date_start).getTime()
  )
  const latestStartedRace = raceSessions.find((session) => new Date(session.date_start).getTime() <= now)
  const session = latestStartedRace || raceSessions[raceSessions.length - 1]

  const drivers = await fetchOpenF1Json(`/drivers?session_key=${session.session_key}`)

  return {
    source: `OpenF1 race session ${session.session_key} (${session.date_start})`,
    warning:
      latestStartedRace || (Array.isArray(drivers) && drivers.length > 0)
        ? null
        : `The selected ${seasonYear} race has not started yet, so OpenF1 may not have driver data.`,
    drivers: Array.isArray(drivers) ? drivers : [],
  }
}

function compareAgainstOpenF1(issues, local, openF1Result) {
  if (openF1Result.warning) {
    addIssue(issues, 'info', 'OpenF1', 'OpenF1 comparison note', openF1Result.warning)
  }

  if (openF1Result.drivers.length === 0) {
    addIssue(issues, 'info', 'OpenF1', 'No OpenF1 drivers to compare', 'The local audit still completed.')
    return
  }

  const constructorsByCanonicalName = new Map(
    local.constructors.map((constructor) => [normalizeConstructorName(constructor.name), constructor])
  )
  const localActiveByCode = new Map(local.drivers.filter((driver) => driver.active).map((driver) => [normalizeCode(driver.code), driver]))
  const openF1ByCode = new Map()

  for (const apiDriver of openF1Result.drivers) {
    openF1ByCode.set(normalizeCode(apiDriver.name_acronym), {
      code: normalizeCode(apiDriver.name_acronym),
      fullName: getOpenF1DriverName(apiDriver),
      teamName: getCanonicalTeamName(apiDriver.team_name),
      rawTeamName: apiDriver.team_name,
    })
  }

  const missingLocally = []
  const staleLocally = []
  const mismatchedLocally = []

  for (const apiDriver of openF1ByCode.values()) {
    const localDriver = localActiveByCode.get(apiDriver.code)
    if (!localDriver) {
      missingLocally.push(apiDriver)
      continue
    }

    const localConstructor = local.constructorById.get(localDriver.constructor_id)
    const canonicalLocalConstructor = getCanonicalTeamName(localConstructor?.name || '')

    if (
      normalizeText(localDriver.full_name) !== normalizeText(apiDriver.fullName) ||
      normalizeConstructorName(canonicalLocalConstructor) !== normalizeConstructorName(apiDriver.teamName)
    ) {
      mismatchedLocally.push({
        code: apiDriver.code,
        localName: localDriver.full_name,
        openF1Name: apiDriver.fullName,
        localTeam: localConstructor?.name || null,
        openF1Team: apiDriver.teamName,
      })
    }

    if (!constructorsByCanonicalName.has(normalizeConstructorName(apiDriver.teamName))) {
      mismatchedLocally.push({
        code: apiDriver.code,
        localName: localDriver.full_name,
        openF1Name: apiDriver.fullName,
        localTeam: localConstructor?.name || null,
        openF1Team: apiDriver.teamName,
        note: 'OpenF1 team is not present as a local constructor.',
      })
    }
  }

  for (const localDriver of localActiveByCode.values()) {
    if (!openF1ByCode.has(normalizeCode(localDriver.code))) {
      const constructor = local.constructorById.get(localDriver.constructor_id)
      staleLocally.push({
        code: localDriver.code,
        full_name: localDriver.full_name,
        constructor: constructor?.name || null,
      })
    }
  }

  if (missingLocally.length > 0) {
    addIssue(
      issues,
      'warning',
      'OpenF1',
      'OpenF1 active drivers missing locally',
      `${missingLocally.length} OpenF1 driver${missingLocally.length === 1 ? '' : 's'} are not active in local data.`,
      missingLocally
    )
  }

  if (staleLocally.length > 0) {
    addIssue(
      issues,
      'warning',
      'OpenF1',
      'Local active drivers absent from OpenF1 session',
      `${staleLocally.length} local active driver${staleLocally.length === 1 ? '' : 's'} did not appear in ${openF1Result.source}.`,
      staleLocally
    )
  }

  if (mismatchedLocally.length > 0) {
    addIssue(
      issues,
      'warning',
      'OpenF1',
      'Local driver/team values differ from OpenF1',
      `${mismatchedLocally.length} local value${mismatchedLocally.length === 1 ? '' : 's'} differ from OpenF1.`,
      mismatchedLocally
    )
  }
}

function validateReferenceData(data, openF1Result = null) {
  const issues = []
  const constructorById = mapById(data.constructors)
  const driverById = mapById(data.drivers)
  const circuitById = mapById(data.circuits)
  const raceById = mapById(data.races)
  const profileById = mapById(data.profiles)
  const questionById = mapById(data.bonusQuestions)
  const optionById = mapById(data.bonusOptions)
  const predictionById = mapById(data.predictions)
  const activeDrivers = data.drivers.filter((driver) => driver.active)

  addDuplicateIssues(
    issues,
    'Constructors',
    'Duplicate constructor names',
    data.constructors,
    (row) => normalizeConstructorName(row.name),
    ['id', 'name', 'short_code']
  )
  addDuplicateIssues(
    issues,
    'Constructors',
    'Duplicate constructor short codes',
    data.constructors,
    (row) => normalizeCode(row.short_code),
    ['id', 'name', 'short_code']
  )
  addDuplicateIssues(
    issues,
    'Drivers',
    'Duplicate driver codes',
    data.drivers,
    (row) => normalizeCode(row.code),
    ['id', 'full_name', 'code', 'active', 'constructor_id'],
    'error'
  )
  addDuplicateIssues(
    issues,
    'Drivers',
    'Duplicate driver names',
    data.drivers,
    (row) => normalizeText(row.full_name),
    ['id', 'full_name', 'code', 'active', 'constructor_id']
  )
  addDuplicateIssues(
    issues,
    'Circuits',
    'Duplicate circuit name/city/country rows',
    data.circuits,
    keyForCircuit,
    ['id', 'name', 'city', 'country']
  )
  addDuplicateIssues(
    issues,
    'Races',
    'Duplicate season/round rows',
    data.races,
    (row) => `${row.season}:${row.round}`,
    ['id', 'season', 'round', 'race_name', 'status'],
    'error'
  )
  addDuplicateIssues(
    issues,
    'Races',
    'Duplicate external race keys',
    data.races.filter((race) => race.external_race_key),
    (row) => `${row.season}:${row.external_race_key}`,
    ['id', 'season', 'round', 'race_name', 'external_race_key']
  )

  const blankConstructors = data.constructors.filter((constructor) => !constructor.name?.trim() || !constructor.short_code?.trim())
  if (blankConstructors.length > 0) {
    addIssue(
      issues,
      'error',
      'Constructors',
      'Constructors with blank required fields',
      'Constructor name and short_code should never be blank.',
      blankConstructors.map((row) => compactRow(row, ['id', 'name', 'short_code']))
    )
  }

  const blankDrivers = data.drivers.filter((driver) => !driver.full_name?.trim() || !driver.code?.trim())
  if (blankDrivers.length > 0) {
    addIssue(
      issues,
      'error',
      'Drivers',
      'Drivers with blank required fields',
      'Driver full_name and code should never be blank.',
      blankDrivers.map((row) => compactRow(row, ['id', 'full_name', 'code']))
    )
  }

  const oddDriverCodes = data.drivers.filter((driver) => driver.code && !/^[A-Z]{3}$/.test(normalizeCode(driver.code)))
  if (oddDriverCodes.length > 0) {
    addIssue(
      issues,
      'warning',
      'Drivers',
      'Driver codes outside three-letter format',
      'F1 timing acronyms are normally three uppercase letters; check these before using automated imports.',
      oddDriverCodes.map((row) => compactRow(row, ['id', 'full_name', 'code', 'active']))
    )
  }

  const activeWithoutConstructor = activeDrivers.filter((driver) => !driver.constructor_id || !constructorById.has(driver.constructor_id))
  if (activeWithoutConstructor.length > 0) {
    addIssue(
      issues,
      'error',
      'Drivers',
      'Active drivers without a known constructor',
      'Active prediction choices should have a constructor mapping.',
      activeWithoutConstructor.map((row) => compactRow(row, ['id', 'full_name', 'code', 'constructor_id']))
    )
  }

  const activeByConstructor = groupBy(activeDrivers, (driver) => driver.constructor_id)
  const unusualActiveConstructorCounts = [...activeByConstructor.entries()]
    .filter(([constructorId, drivers]) => constructorId && drivers.length !== 2)
    .map(([constructorId, drivers]) => ({
      constructor_id: constructorId,
      constructor: constructorById.get(constructorId)?.name || null,
      active_driver_count: drivers.length,
      drivers: drivers.map((driver) => `${driver.code} ${driver.full_name}`),
    }))

  if (unusualActiveConstructorCounts.length > 0) {
    addIssue(
      issues,
      'warning',
      'Drivers',
      'Constructors with other than two active drivers',
      'This is often the clearest symptom of stale drivers or team-switch drift.',
      unusualActiveConstructorCounts
    )
  }

  if (activeDrivers.length % 2 !== 0 || activeDrivers.length < 20) {
    addIssue(
      issues,
      'warning',
      'Drivers',
      'Suspicious active driver count',
      `There are ${activeDrivers.length} active drivers. That may be correct for your season, but it deserves a review.`,
      activeDrivers.map((row) => compactRow(row, ['id', 'full_name', 'code', 'constructor_id']))
    )
  }

  const invalidRaceCircuitRefs = data.races.filter((race) => !circuitById.has(race.circuit_id))
  if (invalidRaceCircuitRefs.length > 0) {
    addIssue(
      issues,
      'error',
      'Races',
      'Races without valid circuits',
      'Foreign keys should prevent this, so this usually means a migration or import problem.',
      invalidRaceCircuitRefs.map((row) => compactRow(row, ['id', 'season', 'round', 'race_name', 'circuit_id']))
    )
  }

  const lockMismatches = data.races
    .filter((race) => race.fp1_at)
    .filter((race) => {
      const expected = new Date(new Date(race.fp1_at).getTime() - 5 * 60_000).toISOString()
      return new Date(race.prediction_lock_at).toISOString() !== expected
    })
    .map((race) => ({
      id: race.id,
      season: race.season,
      round: race.round,
      race_name: race.race_name,
      fp1_at: race.fp1_at,
      prediction_lock_at: race.prediction_lock_at,
      expected_prediction_lock_at: new Date(new Date(race.fp1_at).getTime() - 5 * 60_000).toISOString(),
    }))

  if (lockMismatches.length > 0) {
    addIssue(
      issues,
      'warning',
      'Races',
      'Prediction lock does not match FP1 minus five minutes',
      'Migration 0009 made FP1 the lock source; check races imported before/after that change.',
      lockMismatches
    )
  }

  const invalidBonusOptions = data.bonusOptions.filter((option) => {
    const hasDriver = Boolean(option.driver_id)
    const hasConstructor = Boolean(option.constructor_id)
    const hasCircuit = Boolean(option.circuit_id)
    const hasLabel = Boolean(option.label?.trim())

    if (option.option_type === 'driver') return !hasDriver || hasConstructor || hasCircuit
    if (option.option_type === 'constructor') return !hasConstructor || hasDriver || hasCircuit
    if (option.option_type === 'circuit') return !hasCircuit || hasDriver || hasConstructor || !hasLabel
    if (option.option_type === 'custom_text') return hasDriver || hasConstructor || hasCircuit || !hasLabel
    return true
  })

  if (invalidBonusOptions.length > 0) {
    addIssue(
      issues,
      'error',
      'Bonus Options',
      'Bonus options that violate option_type reference rules',
      'These rows would fail the validate_bonus_option_reference trigger.',
      invalidBonusOptions.map((row) =>
        compactRow(row, ['id', 'bonus_question_id', 'option_type', 'driver_id', 'constructor_id', 'circuit_id', 'label'])
      )
    )
  }

  const mismatchedPredictionBonusAnswers = []
  for (const answer of data.predictionBonusAnswers) {
    const prediction = predictionById.get(answer.prediction_id)
    const question = questionById.get(answer.bonus_question_id)
    const option = optionById.get(answer.bonus_option_id)
    const owner = prediction ? profileById.get(prediction.user_id) : null

    if (
      !prediction ||
      !question ||
      !option ||
      question.race_id !== prediction.race_id ||
      option.bonus_question_id !== question.id ||
      question.tenant_id !== owner?.tenant_id
    ) {
      mismatchedPredictionBonusAnswers.push({
        id: answer.id,
        prediction_id: answer.prediction_id,
        bonus_question_id: answer.bonus_question_id,
        bonus_option_id: answer.bonus_option_id,
        prediction_race_id: prediction?.race_id || null,
        question_race_id: question?.race_id || null,
        owner_tenant_id: owner?.tenant_id || null,
        question_tenant_id: question?.tenant_id || null,
      })
    }
  }

  if (mismatchedPredictionBonusAnswers.length > 0) {
    addIssue(
      issues,
      'error',
      'Predictions',
      'Prediction bonus answers mismatched to race/group/question',
      'These rows can cause scoring surprises because answer, question, prediction, and owner tenant do not line up.',
      mismatchedPredictionBonusAnswers
    )
  }

  const mismatchedRaceBonusAnswers = data.raceBonusAnswers.filter((answer) => {
    const question = questionById.get(answer.bonus_question_id)
    const option = optionById.get(answer.correct_bonus_option_id)
    return !question || !option || question.race_id !== answer.race_id || option.bonus_question_id !== question.id
  })

  if (mismatchedRaceBonusAnswers.length > 0) {
    addIssue(
      issues,
      'error',
      'Results',
      'Race bonus answers mismatched to race/question/option',
      'Official bonus answers should point to an option under a question for the same race.',
      mismatchedRaceBonusAnswers.map((row) =>
        compactRow(row, ['id', 'race_id', 'bonus_question_id', 'correct_bonus_option_id'])
      )
    )
  }

  const predictionDuplicatePodiums = data.predictions.filter((prediction) => {
    const picks = [prediction.p1_driver_id, prediction.p2_driver_id, prediction.p3_driver_id]
    return new Set(picks).size !== picks.length
  })

  if (predictionDuplicatePodiums.length > 0) {
    addIssue(
      issues,
      'error',
      'Predictions',
      'Predictions with duplicate podium drivers',
      'Users should not be able to pick the same driver twice for one podium.',
      predictionDuplicatePodiums.map((row) =>
        compactRow(row, ['id', 'user_id', 'race_id', 'p1_driver_id', 'p2_driver_id', 'p3_driver_id'])
      )
    )
  }

  const resultDuplicatePodiums = data.raceResults.filter((result) => {
    const picks = [result.p1_driver_id, result.p2_driver_id, result.p3_driver_id]
    return new Set(picks).size !== picks.length
  })

  if (resultDuplicatePodiums.length > 0) {
    addIssue(
      issues,
      'error',
      'Results',
      'Official results with duplicate podium drivers',
      'Official podiums must contain three different drivers before scoring.',
      resultDuplicatePodiums.map((row) => compactRow(row, ['id', 'race_id', 'p1_driver_id', 'p2_driver_id', 'p3_driver_id']))
    )
  }

  const inactiveDriverById = new Set(data.drivers.filter((driver) => !driver.active).map((driver) => driver.id))
  const activeRaceStatuses = new Set(['upcoming', 'locked'])
  const upcomingPredictionsUsingInactiveDrivers = []

  for (const prediction of data.predictions) {
    const race = raceById.get(prediction.race_id)
    if (!race || !activeRaceStatuses.has(race.status)) continue

    for (const position of ['p1_driver_id', 'p2_driver_id', 'p3_driver_id']) {
      if (inactiveDriverById.has(prediction[position])) {
        upcomingPredictionsUsingInactiveDrivers.push({
          id: prediction.id,
          race_id: prediction.race_id,
          race_name: race.race_name,
          status: race.status,
          position,
          driver_id: prediction[position],
          driver: driverById.get(prediction[position])?.full_name || null,
        })
      }
    }
  }

  if (upcomingPredictionsUsingInactiveDrivers.length > 0) {
    addIssue(
      issues,
      'warning',
      'Predictions',
      'Upcoming or locked predictions use inactive drivers',
      'This can happen after a lineup sync. Decide whether to preserve submitted picks or force users/admins to revise before lock.',
      upcomingPredictionsUsingInactiveDrivers
    )
  }

  const confirmedProfilesWithoutTenant = data.profiles.filter((profile) => profile.confirmed_at && !profile.tenant_id)
  if (confirmedProfilesWithoutTenant.length > 0) {
    addIssue(
      issues,
      'warning',
      'Tenants',
      'Confirmed profiles without tenant_id',
      'New confirmed users should normally land in the default group.',
      confirmedProfilesWithoutTenant.map((row) => compactRow(row, ['id', 'email', 'role', 'admin_scope', 'tenant_id']))
    )
  }

  const missingNotificationPreferences = data.profiles
    .filter((profile) => profile.confirmed_at)
    .filter((profile) => !data.notificationPreferences.some((preference) => preference.user_id === profile.id))

  if (missingNotificationPreferences.length > 0) {
    addIssue(
      issues,
      'warning',
      'Notifications',
      'Confirmed profiles missing notification preferences',
      'The profile sync trigger should create a preference row for each confirmed profile.',
      missingNotificationPreferences.map((row) => compactRow(row, ['id', 'email', 'confirmed_at']))
    )
  }

  const scoredRaceIds = new Set(data.races.filter((race) => race.status === 'scored').map((race) => race.id))
  const expectedLeaderboard = new Map()

  for (const score of data.userRaceScores) {
    if (!scoredRaceIds.has(score.race_id)) continue
    const race = raceById.get(score.race_id)
    if (!race) continue

    const key = `${race.season}:${score.user_id}`
    const existing = expectedLeaderboard.get(key) || {
      season: race.season,
      user_id: score.user_id,
      total_points: 0,
      exact_hits: 0,
      races_scored: 0,
    }

    existing.total_points += score.total_points || 0
    existing.exact_hits += score.exact_hits || 0
    existing.races_scored += 1
    expectedLeaderboard.set(key, existing)
  }

  const actualLeaderboard = new Map(data.leaderboardCache.map((row) => [`${row.season}:${row.user_id}`, row]))
  const leaderboardMismatches = []

  for (const [key, expected] of expectedLeaderboard.entries()) {
    const actual = actualLeaderboard.get(key)
    if (
      !actual ||
      actual.total_points !== expected.total_points ||
      actual.exact_hits !== expected.exact_hits ||
      actual.races_scored !== expected.races_scored
    ) {
      leaderboardMismatches.push({
        key,
        expected,
        actual: actual
          ? compactRow(actual, ['season', 'user_id', 'total_points', 'exact_hits', 'races_scored', 'updated_at'])
          : null,
      })
    }
  }

  if (leaderboardMismatches.length > 0) {
    addIssue(
      issues,
      'warning',
      'Leaderboard',
      'Leaderboard cache differs from scored race totals',
      'The cache is rebuildable, but public pages and notifications read it directly.',
      leaderboardMismatches
    )
  }

  if (openF1Result) {
    compareAgainstOpenF1(
      issues,
      {
        constructors: data.constructors,
        drivers: data.drivers,
        constructorById,
      },
      openF1Result
    )
  }

  return issues
}

function summarizeIssues(issues) {
  return issues.reduce(
    (summary, issue) => {
      summary[issue.severity] = (summary[issue.severity] || 0) + 1
      return summary
    },
    { error: 0, warning: 0, info: 0 }
  )
}

function renderRows(rows, maxRows = 12) {
  if (!rows || rows.length === 0) return

  const sample = rows.slice(0, maxRows)
  for (const row of sample) {
    console.log(`  - ${JSON.stringify(row)}`)
  }

  if (rows.length > sample.length) {
    console.log(`  - ... ${rows.length - sample.length} more`)
  }
}

function renderMarkdown(report) {
  console.log('# Reference Data Audit')
  console.log('')
  console.log(`Generated: ${report.generatedAt}`)
  console.log(`Season: ${report.season}`)
  console.log(`OpenF1 comparison: ${report.openF1?.enabled ? report.openF1.source || 'enabled' : 'disabled'}`)
  console.log('')
  console.log('## Row Counts')
  console.log('')
  console.log('| table | rows |')
  console.log('| --- | ---: |')

  for (const count of report.counts) {
    console.log(`| ${count.table} | ${count.error ? `error: ${count.error}` : count.count} |`)
  }

  console.log('')
  console.log('## Issue Summary')
  console.log('')
  console.log(`- Errors: ${report.summary.error}`)
  console.log(`- Warnings: ${report.summary.warning}`)
  console.log(`- Info: ${report.summary.info}`)

  if (report.issues.length === 0) {
    console.log('')
    console.log('No issues found by this audit.')
    return
  }

  console.log('')
  console.log('## Issues')

  for (const issue of report.issues) {
    console.log('')
    console.log(`### [${issue.severity}] ${issue.area}: ${issue.title}`)
    console.log(issue.detail)
    renderRows(issue.rows)
  }
}

function shouldFail(summary) {
  if (failOn === 'never') return false
  if (failOn === 'warning') return summary.error > 0 || summary.warning > 0
  if (failOn === 'error') return summary.error > 0
  throw new Error("--fail-on must be one of: never, warning, error")
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const [
    counts,
    profiles,
    constructors,
    drivers,
    circuits,
    races,
    bonusQuestions,
    bonusOptions,
    predictions,
    predictionBonusAnswers,
    raceResults,
    raceBonusAnswers,
    userRaceScores,
    leaderboardCache,
    notificationPreferences,
  ] = await Promise.all([
    Promise.all(TABLES_TO_COUNT.map((table) => countRows(supabase, table))),
    selectAll(supabase, 'profiles', 'id, display_name, email, role, admin_scope, tenant_id, confirmed_at, is_test'),
    selectAll(supabase, 'constructors', 'id, name, short_code, emoji, logo_url'),
    selectAll(supabase, 'drivers', 'id, full_name, code, constructor_id, emoji, image_url, active'),
    selectAll(supabase, 'circuits', 'id, name, city, country, emoji'),
    selectAll(
      supabase,
      'races',
      'id, season, round, race_name, circuit_id, race_start_at, prediction_lock_at, fp1_at, status, external_race_key, schedule_source, schedule_synced_at'
    ),
    selectAll(supabase, 'bonus_questions', 'id, race_id, tenant_id, question_text, points, display_order, is_active'),
    selectAll(supabase, 'bonus_options', 'id, bonus_question_id, option_type, driver_id, constructor_id, circuit_id, label'),
    selectAll(supabase, 'predictions', 'id, user_id, race_id, p1_driver_id, p2_driver_id, p3_driver_id'),
    selectAll(supabase, 'prediction_bonus_answers', 'id, prediction_id, bonus_question_id, bonus_option_id'),
    selectAll(supabase, 'race_results', 'id, race_id, p1_driver_id, p2_driver_id, p3_driver_id, source, entered_at'),
    selectAll(supabase, 'race_bonus_answers', 'id, race_id, bonus_question_id, correct_bonus_option_id'),
    selectAll(supabase, 'user_race_scores', 'id, user_id, race_id, total_points, exact_hits'),
    selectAll(supabase, 'leaderboard_cache', 'id, season, user_id, total_points, exact_hits, races_scored, updated_at'),
    selectAll(
      supabase,
      'notification_preferences',
      'user_id, race_reminder_emails_enabled, score_recap_emails_enabled',
      'user_id'
    ),
  ])

  const openF1Result = includeOpenF1 ? await fetchOpenF1SeasonDrivers(season) : null
  const issues = validateReferenceData(
    {
      profiles,
      constructors,
      drivers,
      circuits,
      races,
      bonusQuestions,
      bonusOptions,
      predictions,
      predictionBonusAnswers,
      raceResults,
      raceBonusAnswers,
      userRaceScores,
      leaderboardCache,
      notificationPreferences,
    },
    openF1Result
  )
  const summary = summarizeIssues(issues)
  const report = {
    generatedAt: new Date().toISOString(),
    season,
    counts,
    summary,
    issues,
    openF1: includeOpenF1
      ? {
          enabled: true,
          source: openF1Result?.source || null,
          driverCount: openF1Result?.drivers.length || 0,
          warning: openF1Result?.warning || null,
        }
      : { enabled: false },
  }

  if (outputJson) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    renderMarkdown(report)
  }

  if (shouldFail(summary)) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
