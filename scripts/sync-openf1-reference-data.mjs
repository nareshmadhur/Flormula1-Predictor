import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: '.env.local' })

const OPEN_F1_API_BASE = 'https://api.openf1.org/v1'

const TEAM_SHORT_CODE_MAP = {
  'McLaren': 'MCL',
  'Red Bull Racing': 'RBR',
  'Audi': 'AUD',
  'Alpine': 'ALP',
  'Cadillac': 'CAD',
  'Mercedes': 'MER',
  'Aston Martin': 'AST',
  'Ferrari': 'FER',
  'Williams': 'WIL',
  'Racing Bulls': 'RB',
  'Haas F1 Team': 'HAA',
}

const TEAM_ALIASES = {
  'McLaren': ['mclaren'],
  'Red Bull Racing': ['red bull racing', 'red bull', 'oracle red bull'],
  'Audi': ['audi', 'sauber', 'stake', 'stake sauber'],
  'Alpine': ['alpine'],
  'Cadillac': ['cadillac'],
  'Mercedes': ['mercedes', 'mercedes amg', 'mercedes-amg'],
  'Aston Martin': ['aston martin', 'aston martin aramco'],
  'Ferrari': ['ferrari', 'scuderia ferrari'],
  'Williams': ['williams'],
  'Racing Bulls': ['racing bulls', 'rb', 'visa cash app rb', 'visa cash app racing bulls'],
  'Haas F1 Team': ['haas', 'haas f1 team'],
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

function normalizeDriverName(value) {
  return normalizeText(value)
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

async function fetchOpenF1Json(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`OpenF1 request failed with ${response.status}`)
  }

  return response.json()
}

async function getLatestSeasonDrivers(season) {
  const sessions = await fetchOpenF1Json(`${OPEN_F1_API_BASE}/sessions?year=${season}&session_name=Race`)

  if (!Array.isArray(sessions) || sessions.length === 0) {
    throw new Error(`No race sessions found for season ${season}`)
  }

  const latestRaceSession = [...sessions].sort(
    (left, right) => new Date(right.date_start).getTime() - new Date(left.date_start).getTime()
  )[0]

  const drivers = await fetchOpenF1Json(`${OPEN_F1_API_BASE}/drivers?session_key=${latestRaceSession.session_key}`)
  if (!Array.isArray(drivers) || drivers.length === 0) {
    throw new Error(`No drivers returned for latest ${season} race session`)
  }

  return drivers
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const season = Number(process.argv[2] || new Date().getFullYear())

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials in environment')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const openF1Drivers = await getLatestSeasonDrivers(season)

  const { data: existingConstructors, error: constructorsError } = await supabase
    .from('constructors')
    .select('id, name, short_code, emoji, logo_url')
    .order('name')

  if (constructorsError) {
    throw new Error(`Could not load constructors: ${constructorsError.message}`)
  }

  const { data: existingDrivers, error: driversError } = await supabase
    .from('drivers')
    .select('id, full_name, code, constructor_id, emoji, image_url, active')
    .order('full_name')

  if (driversError) {
    throw new Error(`Could not load drivers: ${driversError.message}`)
  }

  const constructors = [...(existingConstructors || [])]
  const drivers = [...(existingDrivers || [])]

  const constructorIdByCanonicalName = new Map()
  let constructorsUpdated = 0
  let constructorsInserted = 0

  for (const apiDriver of openF1Drivers) {
    const canonicalTeamName = getCanonicalTeamName(apiDriver.team_name)
    if (constructorIdByCanonicalName.has(canonicalTeamName)) continue

    const normalizedTeam = normalizeConstructorName(canonicalTeamName)
    const existingConstructor =
      constructors.find((constructor) => normalizeConstructorName(constructor.name) === normalizedTeam) ||
      constructors.find((constructor) => {
        const aliases = TEAM_ALIASES[canonicalTeamName] || []
        return aliases.some((alias) => normalizeConstructorName(constructor.name) === normalizeConstructorName(alias))
      })

    if (existingConstructor) {
      const nextShortCode = TEAM_SHORT_CODE_MAP[canonicalTeamName] || existingConstructor.short_code
      const needsUpdate =
        existingConstructor.name !== canonicalTeamName ||
        existingConstructor.short_code !== nextShortCode

      if (needsUpdate) {
        const { error } = await supabase
          .from('constructors')
          .update({
            name: canonicalTeamName,
            short_code: nextShortCode,
          })
          .eq('id', existingConstructor.id)

        if (error) {
          throw new Error(`Failed to update constructor ${canonicalTeamName}: ${error.message}`)
        }

        existingConstructor.name = canonicalTeamName
        existingConstructor.short_code = nextShortCode
        constructorsUpdated += 1
      }

      constructorIdByCanonicalName.set(canonicalTeamName, existingConstructor.id)
      continue
    }

    const { data: insertedConstructor, error } = await supabase
      .from('constructors')
      .insert({
        name: canonicalTeamName,
        short_code: TEAM_SHORT_CODE_MAP[canonicalTeamName] || canonicalTeamName.slice(0, 3).toUpperCase(),
      })
      .select('id')
      .single()

    if (error || !insertedConstructor) {
      throw new Error(`Failed to insert constructor ${canonicalTeamName}: ${error?.message || 'Unknown error'}`)
    }

    constructors.push({
      id: insertedConstructor.id,
      name: canonicalTeamName,
      short_code: TEAM_SHORT_CODE_MAP[canonicalTeamName] || canonicalTeamName.slice(0, 3).toUpperCase(),
      emoji: null,
      logo_url: null,
    })
    constructorIdByCanonicalName.set(canonicalTeamName, insertedConstructor.id)
    constructorsInserted += 1
  }

  let driversUpdated = 0
  let driversInserted = 0
  const activeDriverIds = new Set()

  for (const apiDriver of openF1Drivers) {
    const fullName = `${apiDriver.first_name} ${apiDriver.last_name}`
    const constructorId = constructorIdByCanonicalName.get(getCanonicalTeamName(apiDriver.team_name)) || null
    const existingDriver =
      drivers.find((driver) => (driver.code || '').toUpperCase() === apiDriver.name_acronym.toUpperCase()) ||
      drivers.find((driver) => normalizeDriverName(driver.full_name) === normalizeDriverName(fullName))

    if (existingDriver) {
      const nextPayload = {
        code: apiDriver.name_acronym.toUpperCase(),
        full_name: fullName,
        constructor_id: constructorId,
        image_url: apiDriver.headshot_url || existingDriver.image_url || null,
        active: true,
      }

      const needsUpdate =
        existingDriver.code !== nextPayload.code ||
        existingDriver.full_name !== nextPayload.full_name ||
        existingDriver.constructor_id !== nextPayload.constructor_id ||
        existingDriver.image_url !== nextPayload.image_url ||
        existingDriver.active !== true

      if (needsUpdate) {
        const { error } = await supabase.from('drivers').update(nextPayload).eq('id', existingDriver.id)
        if (error) {
          throw new Error(`Failed to update driver ${fullName}: ${error.message}`)
        }

        Object.assign(existingDriver, nextPayload)
        driversUpdated += 1
      }

      activeDriverIds.add(existingDriver.id)
      continue
    }

    const { data: insertedDriver, error } = await supabase
      .from('drivers')
      .insert({
        code: apiDriver.name_acronym.toUpperCase(),
        full_name: fullName,
        constructor_id: constructorId,
        image_url: apiDriver.headshot_url || null,
        active: true,
      })
      .select('id')
      .single()

    if (error || !insertedDriver) {
      throw new Error(`Failed to insert driver ${fullName}: ${error?.message || 'Unknown error'}`)
    }

    drivers.push({
      id: insertedDriver.id,
      code: apiDriver.name_acronym.toUpperCase(),
      full_name: fullName,
      constructor_id: constructorId,
      emoji: null,
      image_url: apiDriver.headshot_url || null,
      active: true,
    })
    activeDriverIds.add(insertedDriver.id)
    driversInserted += 1
  }

  const driversToDeactivate = drivers.filter((driver) => driver.active && !activeDriverIds.has(driver.id))
  let driversDeactivated = 0

  if (driversToDeactivate.length > 0) {
    const { error } = await supabase
      .from('drivers')
      .update({ active: false })
      .in('id', driversToDeactivate.map((driver) => driver.id))

    if (error) {
      throw new Error(`Failed to deactivate previous drivers: ${error.message}`)
    }

    driversDeactivated = driversToDeactivate.length
  }

  console.log(
    JSON.stringify(
      {
        season,
        constructorsUpdated,
        constructorsInserted,
        driversUpdated,
        driversInserted,
        driversDeactivated,
        source: 'OpenF1 latest race session',
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
