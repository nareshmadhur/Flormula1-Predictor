import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { isTestModeProfile } from '@/utils/test-mode'

type GroupRaceClient = ReturnType<typeof createServiceRoleClient>

type GroupProfile = {
  id: string
  display_name?: string | null
  email?: string | null
  is_test?: boolean | null
  tenants?: { is_test?: boolean | null } | Array<{ is_test?: boolean | null }> | null
}

export type GroupRacePrediction = {
  userId: string
  displayName?: string | null
  email?: string | null
  p1DriverId: string
  p2DriverId: string
  p3DriverId: string
}

export type GroupRaceExperience = {
  totalMembers: number
  submittedEntries: number
  predictions: GroupRacePrediction[]
}

export type GroupPredictionInsight = {
  kind: 'consensus' | 'bold-call'
  driverId: string
  count: number
  slot?: 'P1' | 'P2' | 'P3'
}

type PredictionRow = {
  user_id: string
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type SeasonConsistencyRace = {
  id: string
  status: 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'
  race_start_at: string
}

export async function getGroupRaceExperienceWithClient(
  supabase: GroupRaceClient,
  tenantId: string,
  raceId: string
): Promise<GroupRaceExperience> {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, email, is_test, tenants(is_test)')
    .eq('tenant_id', tenantId)

  if (profilesError) {
    throw new Error(`Failed to load group members: ${profilesError.message}`)
  }

  const operationalProfiles = ((profiles || []) as GroupProfile[]).filter(
    (profile) => !isTestModeProfile(profile)
  )
  const profileById = new Map(operationalProfiles.map((profile) => [profile.id, profile]))
  const memberIds = operationalProfiles.map((profile) => profile.id)

  if (memberIds.length === 0) {
    return {
      totalMembers: 0,
      submittedEntries: 0,
      predictions: [],
    }
  }

  const { data: predictions, error: predictionsError } = await supabase
    .from('predictions')
    .select('user_id, p1_driver_id, p2_driver_id, p3_driver_id')
    .eq('race_id', raceId)
    .in('user_id', memberIds)

  if (predictionsError) {
    throw new Error(`Failed to load group predictions: ${predictionsError.message}`)
  }

  const typedPredictions = (predictions || []) as PredictionRow[]

  return {
    totalMembers: operationalProfiles.length,
    submittedEntries: typedPredictions.length,
    predictions: typedPredictions.map((prediction) => {
      const profile = profileById.get(prediction.user_id)

      return {
        userId: prediction.user_id,
        displayName: profile?.display_name,
        email: profile?.email,
        p1DriverId: prediction.p1_driver_id,
        p2DriverId: prediction.p2_driver_id,
        p3DriverId: prediction.p3_driver_id,
      }
    }),
  }
}

export async function getPrivateGroupRaceExperience(
  tenantId: string | null | undefined,
  raceId: string | null | undefined
) {
  if (!tenantId || !raceId) return null

  try {
    return await getGroupRaceExperienceWithClient(createServiceRoleClient(), tenantId, raceId)
  } catch (error) {
    console.error('Failed to load private group race experience', error)
    return null
  }
}

function countDrivers(predictions: GroupRacePrediction[]) {
  const counts = new Map<string, number>()

  predictions.forEach((prediction) => {
    ;[prediction.p1DriverId, prediction.p2DriverId, prediction.p3DriverId].forEach((driverId) => {
      counts.set(driverId, (counts.get(driverId) || 0) + 1)
    })
  })

  return counts
}

export function getGroupPredictionInsights(
  predictions: GroupRacePrediction[],
  currentUserId?: string | null
) {
  const driverCounts = countDrivers(predictions)
  const consensus = [...driverCounts.entries()]
    .map(([driverId, count]) => ({ kind: 'consensus' as const, driverId, count }))
    .sort((left, right) => right.count - left.count || left.driverId.localeCompare(right.driverId))[0] || null

  const currentPrediction = predictions.find((prediction) => prediction.userId === currentUserId)
  const boldCallCandidates: GroupPredictionInsight[] = currentPrediction
    ? [
        { kind: 'bold-call', slot: 'P1', driverId: currentPrediction.p1DriverId, count: driverCounts.get(currentPrediction.p1DriverId) || 0 },
        { kind: 'bold-call', slot: 'P2', driverId: currentPrediction.p2DriverId, count: driverCounts.get(currentPrediction.p2DriverId) || 0 },
        { kind: 'bold-call', slot: 'P3', driverId: currentPrediction.p3DriverId, count: driverCounts.get(currentPrediction.p3DriverId) || 0 },
      ]
    : []
  const boldCall =
    boldCallCandidates
      .sort((left, right) => left.count - right.count || String(left.slot).localeCompare(String(right.slot)))[0] || null

  return {
    consensus,
    boldCall:
      boldCall && boldCall.count <= Math.max(1, Math.floor(predictions.length / 3))
        ? boldCall
        : null,
  }
}

export function getPersonalRecapInsight({
  prediction,
  officialPodiumIds,
  exactHits,
  groupPredictions,
}: {
  prediction: GroupRacePrediction | null
  officialPodiumIds: string[]
  exactHits: number
  groupPredictions: GroupRacePrediction[]
}) {
  if (!prediction || officialPodiumIds.length !== 3) return null

  const predictedIds = [prediction.p1DriverId, prediction.p2DriverId, prediction.p3DriverId]
  const podiumHits = predictedIds.filter((driverId) => officialPodiumIds.includes(driverId))

  if (podiumHits.length === 3 && exactHits < 3) {
    return {
      eyebrow: 'Near miss',
      title: 'All three podium drivers were in your call.',
      description: 'The order kept it from becoming a perfect podium.',
    }
  }

  const driverCounts = countDrivers(groupPredictions)
  const sharpCall = podiumHits
    .map((driverId) => ({ driverId, count: driverCounts.get(driverId) || 0 }))
    .sort((left, right) => left.count - right.count || left.driverId.localeCompare(right.driverId))[0]

  if (sharpCall && sharpCall.count <= Math.max(1, Math.floor(groupPredictions.length / 3))) {
    return {
      eyebrow: 'Sharp call',
      title: sharpCall.driverId,
      description: `Only ${sharpCall.count} player${sharpCall.count === 1 ? '' : 's'} in your group backed this podium pick.`,
      driverId: sharpCall.driverId,
    }
  }

  if (exactHits > 0) {
    return {
      eyebrow: 'Exact read',
      title: `${exactHits} podium slot${exactHits === 1 ? '' : 's'} landed exactly.`,
      description: 'That precision added the strongest part of your weekend score.',
    }
  }

  return {
    eyebrow: 'Next race',
    title: 'The season continues.',
    description: 'Use the next weekend to reset your call and close the gap.',
  }
}

export function getRaceWeekendConsistency(
  races: SeasonConsistencyRace[],
  predictedRaceIds: Set<string>
) {
  const settled = races
    .filter((race) => race.status !== 'cancelled' && race.status !== 'upcoming')
    .sort((left, right) => new Date(left.race_start_at).getTime() - new Date(right.race_start_at).getTime())
  const firstEnteredUpcoming = races
    .filter((race) => race.status === 'upcoming' && predictedRaceIds.has(race.id))
    .sort((left, right) => new Date(left.race_start_at).getTime() - new Date(right.race_start_at).getTime())[0]
  const sequence = firstEnteredUpcoming ? [...settled, firstEnteredUpcoming] : settled

  let currentRun = 0
  for (const race of [...sequence].reverse()) {
    if (!predictedRaceIds.has(race.id)) break
    currentRun += 1
  }

  return {
    enteredCount: races.filter((race) => predictedRaceIds.has(race.id)).length,
    currentRun,
  }
}
