import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'

export type RaceFocusRace = {
  id: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
}

function sortByStartAsc<T extends RaceFocusRace>(left: T, right: T) {
  return new Date(left.race_start_at).getTime() - new Date(right.race_start_at).getTime()
}

function sortByStartDesc<T extends RaceFocusRace>(left: T, right: T) {
  return new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime()
}

export function getRaceFocus<T extends RaceFocusRace>(races: T[]) {
  const availableRaces = races.filter((race) => getEffectiveRaceStatus(race) !== 'cancelled')
  const lockedRaces = availableRaces
    .filter((race) => getEffectiveRaceStatus(race) === 'locked')
    .sort(sortByStartAsc)
  const completedRaces = availableRaces
    .filter((race) => getEffectiveRaceStatus(race) === 'completed')
    .sort(sortByStartDesc)
  const upcomingRaces = availableRaces
    .filter((race) => getEffectiveRaceStatus(race) === 'upcoming')
    .sort(sortByStartAsc)
  const scoredRaces = availableRaces
    .filter((race) => getEffectiveRaceStatus(race) === 'scored')
    .sort(sortByStartDesc)

  const currentWeekend = lockedRaces[0] || completedRaces[0] || null
  const nextOpenRace = upcomingRaces[0] || null
  const latestRecap = scoredRaces[0] || null

  return {
    currentWeekend,
    nextOpenRace,
    latestRecap,
    primaryRace: currentWeekend || nextOpenRace || latestRecap,
    secondaryRace: currentWeekend ? nextOpenRace : latestRecap,
    lockedRaces,
    completedRaces,
    upcomingRaces,
    scoredRaces,
  }
}

export function sortRacesByFocus<T extends RaceFocusRace>(races: T[]) {
  const priority = (race: T) => {
    const status = getEffectiveRaceStatus(race)
    if (status === 'locked') return 0
    if (status === 'completed') return 1
    if (status === 'upcoming') return 2
    if (status === 'scored') return 3
    return 4
  }

  return [...races].sort((left, right) => {
    const priorityDelta = priority(left) - priority(right)
    if (priorityDelta !== 0) return priorityDelta

    const status = getEffectiveRaceStatus(left)
    return status === 'upcoming' || status === 'locked'
      ? sortByStartAsc(left, right)
      : sortByStartDesc(left, right)
  })
}
