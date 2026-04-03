const OPEN_F1_API_BASE = 'https://api.openf1.org/v1'

type OpenF1Meeting = {
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  location: string
  country_name: string
  circuit_short_name: string
  gmt_offset: string
  date_start: string
  date_end: string
  year: number
}

type OpenF1Session = {
  session_key: number
  meeting_key: number
  session_name: string
  date_start: string
}

type OpenF1Driver = {
  driver_number: number
  name_acronym: string
  full_name: string
}

type OpenF1SessionResult = {
  position: number
  driver_number: number
}

export type OpenF1ImportedRace = {
  season: number
  round: number
  meetingKey: number
  raceName: string
  officialName: string
  location: string
  countryName: string
  circuitShortName: string
  gmtOffset: string
  raceStartAt: string
  predictionLockAt: string
  fp1At: string | null
  fp2At: string | null
  fp3At: string | null
  qualiAt: string | null
  sprintAt: string | null
  sprintQualiAt: string | null
  isSprintWeekend: boolean
  sourceUrl: string
}

export type OpenF1CircuitLookup = {
  id: string
  name: string
  city?: string | null
  country?: string | null
  emoji?: string | null
}

export type ExistingRaceForImport = {
  id: string
  season: number
  round: number
  race_name: string
  circuit_id: string
  status: string
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

export type OpenF1FieldChange = {
  label: string
  current: string | null
  imported: string | null
}

export type OpenF1ScheduleReviewRow = {
  imported: OpenF1ImportedRace
  existingRace: ExistingRaceForImport | null
  circuitMatch: OpenF1CircuitLookup | null
  action: 'update' | 'create' | 'skip'
  tone: 'update' | 'create' | 'attention' | 'calm'
  fieldChanges: OpenF1FieldChange[]
}

export type OpenF1SuggestedPodium = {
  source: string
  p1: {
    code: string
    fullName: string
    localDriverId: string | null
  } | null
  p2: {
    code: string
    fullName: string
    localDriverId: string | null
  } | null
  p3: {
    code: string
    fullName: string
    localDriverId: string | null
  } | null
}

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/grand prix/g, '')
    .replace(/international/g, '')
    .replace(/circuit/g, '')
    .replace(/course/g, '')
    .replace(/autodrome/g, '')
    .replace(/racing/g, '')
    .replace(/ring/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeDriverName(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/\b[a-z]{1,3}\b/g, '')
    .trim()
}

function isGrandPrixMeeting(meeting: OpenF1Meeting) {
  return /grand prix/i.test(meeting.meeting_name)
}

function getOpenF1SourceUrl(meetingKey: number) {
  return `${OPEN_F1_API_BASE}/sessions?meeting_key=${meetingKey}`
}

function getPredictionLockAt(fp1At: string | null, raceStartAt: string) {
  const lockSource = fp1At ? new Date(fp1At) : new Date(raceStartAt)
  return new Date(lockSource.getTime() - 5 * 60_000).toISOString()
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null
  return new Date(value).toISOString()
}

function getSessionStart(
  sessions: OpenF1Session[],
  sessionName: 'Practice 1' | 'Practice 2' | 'Practice 3' | 'Qualifying' | 'Sprint Qualifying' | 'Sprint' | 'Race'
) {
  return sessions.find((session) => session.session_name === sessionName)?.date_start || null
}

async function fetchOpenF1Json<T>(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`OpenF1 request failed with ${response.status}`)
  }

  return (await response.json()) as T
}

export async function fetchOpenF1SeasonSchedule(season: number) {
  const meetingsUrl = `${OPEN_F1_API_BASE}/meetings?year=${season}`
  const sessionsUrl = `${OPEN_F1_API_BASE}/sessions?year=${season}`

  const [meetings, sessions] = await Promise.all([
    fetchOpenF1Json<OpenF1Meeting[]>(meetingsUrl),
    fetchOpenF1Json<OpenF1Session[]>(sessionsUrl),
  ])

  const sessionsByMeeting = new Map<number, OpenF1Session[]>()
  for (const session of sessions) {
    const group = sessionsByMeeting.get(session.meeting_key) || []
    group.push(session)
    sessionsByMeeting.set(session.meeting_key, group)
  }

  const orderedMeetings = meetings
    .filter(isGrandPrixMeeting)
    .sort((left, right) => new Date(left.date_start).getTime() - new Date(right.date_start).getTime())

  return orderedMeetings.map((meeting, index) => {
    const meetingSessions = (sessionsByMeeting.get(meeting.meeting_key) || []).sort(
      (left, right) => new Date(left.date_start).getTime() - new Date(right.date_start).getTime()
    )

    const fp1At = getSessionStart(meetingSessions, 'Practice 1')
    const fp2At = getSessionStart(meetingSessions, 'Practice 2')
    const fp3At = getSessionStart(meetingSessions, 'Practice 3')
    const sprintQualiAt = getSessionStart(meetingSessions, 'Sprint Qualifying')
    const sprintAt = getSessionStart(meetingSessions, 'Sprint')
    const qualiAt = getSessionStart(meetingSessions, 'Qualifying')
    const raceStartAt = getSessionStart(meetingSessions, 'Race') || meeting.date_end

    return {
      season,
      round: index + 1,
      meetingKey: meeting.meeting_key,
      raceName: meeting.meeting_name,
      officialName: meeting.meeting_official_name,
      location: meeting.location,
      countryName: meeting.country_name,
      circuitShortName: meeting.circuit_short_name,
      gmtOffset: meeting.gmt_offset.slice(0, 6),
      raceStartAt,
      predictionLockAt: getPredictionLockAt(fp1At, raceStartAt),
      fp1At,
      fp2At,
      fp3At,
      qualiAt,
      sprintAt,
      sprintQualiAt,
      isSprintWeekend: Boolean(sprintAt || sprintQualiAt),
      sourceUrl: getOpenF1SourceUrl(meeting.meeting_key),
    } satisfies OpenF1ImportedRace
  })
}

export function matchCircuitForOpenF1Race(
  importedRace: OpenF1ImportedRace,
  circuits: OpenF1CircuitLookup[]
) {
  const importedLocation = normalizeText(importedRace.location)
  const importedShortName = normalizeText(importedRace.circuitShortName)
  const importedCountry = normalizeText(importedRace.countryName)
  const importedRaceName = normalizeText(importedRace.raceName)

  const rankedMatches = circuits
    .map((circuit) => {
      const name = normalizeText(circuit.name)
      const city = normalizeText(circuit.city)
      const country = normalizeText(circuit.country)

      let score = 0

      if (name && name === importedShortName) score = Math.max(score, 100)
      if (name && (name.includes(importedShortName) || importedShortName.includes(name))) score = Math.max(score, 92)
      if (city && city === importedLocation) score = Math.max(score, 105)
      if (city && (city.includes(importedLocation) || importedLocation.includes(city))) score = Math.max(score, 96)
      if (name && importedRaceName && (importedRaceName.includes(name) || name.includes(importedRaceName))) {
        score = Math.max(score, 88)
      }
      if (country && country === importedCountry) score += 6

      return { circuit, score }
    })
    .sort((left, right) => right.score - left.score)

  const bestMatch = rankedMatches[0]
  const secondMatch = rankedMatches[1]

  if (!bestMatch || bestMatch.score < 90) return null
  if (secondMatch && bestMatch.score - secondMatch.score < 4) return null

  return bestMatch.circuit
}

function compareImportField(
  fieldChanges: OpenF1FieldChange[],
  label: string,
  currentValue: string | null | undefined,
  importedValue: string | null | undefined
) {
  const normalizedCurrent = normalizeDate(currentValue)
  const normalizedImported = normalizeDate(importedValue)

  if (normalizedCurrent !== normalizedImported) {
    fieldChanges.push({
      label,
      current: normalizedCurrent,
      imported: normalizedImported,
    })
  }
}

function compareImportTextField(
  fieldChanges: OpenF1FieldChange[],
  label: string,
  currentValue: string | null | undefined,
  importedValue: string | null | undefined
) {
  if ((currentValue || null) !== (importedValue || null)) {
    fieldChanges.push({
      label,
      current: currentValue || null,
      imported: importedValue || null,
    })
  }
}

export function buildOpenF1ScheduleReview(
  importedRaces: OpenF1ImportedRace[],
  existingRaces: ExistingRaceForImport[],
  circuits: OpenF1CircuitLookup[]
) {
  const racesByRound = new Map(existingRaces.map((race) => [race.round, race]))

  return importedRaces.map((importedRace) => {
    const existingRace = racesByRound.get(importedRace.round) || null
    const circuitMatch = matchCircuitForOpenF1Race(importedRace, circuits)
    const fieldChanges: OpenF1FieldChange[] = []

    if (existingRace) {
      compareImportTextField(fieldChanges, 'Race name', existingRace.race_name, importedRace.raceName)
      compareImportTextField(
        fieldChanges,
        'Circuit',
        existingRace.circuit_id,
        circuitMatch?.id || existingRace.circuit_id
      )
      compareImportField(fieldChanges, 'Race', existingRace.race_start_at, importedRace.raceStartAt)
      compareImportField(fieldChanges, 'Lock', existingRace.prediction_lock_at, importedRace.predictionLockAt)
      compareImportField(fieldChanges, 'FP1', existingRace.fp1_at, importedRace.fp1At)
      compareImportField(fieldChanges, 'FP2', existingRace.fp2_at, importedRace.fp2At)
      compareImportField(fieldChanges, 'FP3', existingRace.fp3_at, importedRace.fp3At)
      compareImportField(fieldChanges, 'Qualifying', existingRace.quali_at, importedRace.qualiAt)
      compareImportField(fieldChanges, 'Sprint', existingRace.sprint_at, importedRace.sprintAt)
      compareImportField(
        fieldChanges,
        'Sprint Qualifying',
        existingRace.sprint_quali_at,
        importedRace.sprintQualiAt
      )
      compareImportTextField(fieldChanges, 'Source key', existingRace.external_race_key, String(importedRace.meetingKey))
    }

    if (existingRace) {
      return {
        imported: importedRace,
        existingRace,
        circuitMatch,
        action: fieldChanges.length > 0 ? 'update' : 'skip',
        tone: fieldChanges.length > 0 ? 'update' : 'calm',
        fieldChanges,
      } satisfies OpenF1ScheduleReviewRow
    }

    if (circuitMatch) {
      return {
        imported: importedRace,
        existingRace: null,
        circuitMatch,
        action: 'create',
        tone: 'create',
        fieldChanges: [],
      } satisfies OpenF1ScheduleReviewRow
    }

    return {
      imported: importedRace,
      existingRace: null,
      circuitMatch: null,
      action: 'skip',
      tone: 'attention',
      fieldChanges: [],
    } satisfies OpenF1ScheduleReviewRow
  })
}

function findLocalDriverMatch(
  openF1Driver: OpenF1Driver | undefined,
  localDrivers: { id: string; code: string; full_name: string }[]
) {
  if (!openF1Driver) return null

  const byCode = localDrivers.find(
    (driver) => driver.code.toUpperCase() === openF1Driver.name_acronym.toUpperCase()
  )

  if (byCode) return byCode

  const normalizedOpenF1Name = normalizeDriverName(openF1Driver.full_name)
  return (
    localDrivers.find(
      (driver) => normalizeDriverName(driver.full_name) === normalizedOpenF1Name
    ) || null
  )
}

export async function fetchOpenF1PodiumSuggestion(
  meetingKey: string | number | null | undefined,
  localDrivers: { id: string; code: string; full_name: string }[]
): Promise<OpenF1SuggestedPodium | null> {
  if (!meetingKey) return null

  const raceSessions = await fetchOpenF1Json<OpenF1Session[]>(
    `${OPEN_F1_API_BASE}/sessions?meeting_key=${meetingKey}&session_name=Race`
  )
  const raceSession = raceSessions[0]
  if (!raceSession?.session_key) return null

  const [results, drivers] = await Promise.all([
    fetchOpenF1Json<OpenF1SessionResult[]>(
      `${OPEN_F1_API_BASE}/session_result?session_key=${raceSession.session_key}&position<=3`
    ),
    fetchOpenF1Json<OpenF1Driver[]>(
      `${OPEN_F1_API_BASE}/drivers?session_key=${raceSession.session_key}`
    ),
  ])

  if (!results?.length) return null

  const driversByNumber = new Map(drivers.map((driver) => [driver.driver_number, driver]))

  const buildSuggestion = (position: number) => {
    const result = results.find((entry) => entry.position === position)
    if (!result) return null

    const openF1Driver = driversByNumber.get(result.driver_number)
    if (!openF1Driver) return null

    const localDriver = findLocalDriverMatch(openF1Driver, localDrivers)

    return {
      code: openF1Driver.name_acronym,
      fullName: openF1Driver.full_name,
      localDriverId: localDriver?.id || null,
    }
  }

  return {
    source: 'OpenF1',
    p1: buildSuggestion(1),
    p2: buildSuggestion(2),
    p3: buildSuggestion(3),
  }
}
