import { isPast } from 'date-fns'

export type RaceStatus = 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'

export interface Race {
  id: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
  // Add other race properties as needed
}

/**
 * Determines the effective status of a race based on time and stored status
 * This ensures that time-based logic takes precedence over manual status updates
 */
export function getEffectiveRaceStatus(race: Race): RaceStatus {
  // If race is manually cancelled, keep that status
  if (race.status === 'cancelled') {
    return 'cancelled'
  }

  const raceStartTime = new Date(race.race_start_at)
  const lockTime = new Date(race.prediction_lock_at)

  // If race has already started, it should be completed (or scored if results are in)
  if (isPast(raceStartTime)) {
    // If it was manually marked as scored, keep that status
    if (race.status === 'scored') {
      return 'scored'
    }
    // Otherwise, it's completed (race finished but not yet scored)
    return 'completed'
  }

  // If predictions are locked (normally 5 minutes before FP1), mark as locked
  if (isPast(lockTime)) {
    return 'locked'
  }

  // Otherwise, it's upcoming
  return 'upcoming'
}

/**
 * Checks if a race is available for predictions
 * A race is available if it's upcoming and predictions are not locked
 */
export function isRaceAvailableForPredictions(race: Race): boolean {
  const status = getEffectiveRaceStatus(race)
  return status === 'upcoming'
}

/**
 * Checks if a race has finished (past race start time)
 */
export function isRaceFinished(race: Race): boolean {
  return isPast(new Date(race.race_start_at))
}

/**
 * Checks if predictions are locked for a race
 */
export function isRaceLocked(race: Race): boolean {
  return isPast(new Date(race.prediction_lock_at))
}
