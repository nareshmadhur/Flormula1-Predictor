import type { RaceStatus } from '@/utils/race-status'

export type RaceTone = 'open' | 'pending' | 'scored' | 'cancelled'

export function getRaceTone(status: RaceStatus): RaceTone {
  if (status === 'upcoming') return 'open'
  if (status === 'locked' || status === 'completed') return 'pending'
  if (status === 'scored') return 'scored'
  return 'cancelled'
}

export function getRaceStatusLabel(status: RaceStatus) {
  if (status === 'upcoming') return 'Open now'
  if (status === 'locked') return 'Weekend live'
  if (status === 'completed') return 'Results pending'
  if (status === 'scored') return 'Scored'
  return 'Cancelled'
}

export function getMemberRaceActionLabel(status: RaceStatus, hasEntry: boolean) {
  if (status === 'upcoming') return hasEntry ? 'Edit entry' : 'Predict now'
  if (status === 'locked' || status === 'completed') return hasEntry ? 'Track weekend' : 'Review weekend'
  if (status === 'scored') return hasEntry ? 'View recap' : 'Review weekend'
  return 'Details'
}

export function getPublicRaceActionLabel(status: RaceStatus) {
  if (status === 'scored') return 'Recap'
  if (status === 'cancelled') return 'Details'
  return 'Race'
}

export function getRaceParticipationLabel(status: RaceStatus, hasEntry: boolean) {
  if (status === 'upcoming') return hasEntry ? 'Entry locked in' : 'No entry yet'
  if (status === 'locked') return hasEntry ? 'Entry locked' : 'Closed without entry'
  if (status === 'completed') return hasEntry ? 'Waiting on scoring' : 'Missed weekend'
  if (status === 'scored') return hasEntry ? 'Scored' : 'No entry'
  return 'Cancelled'
}

export function getRaceToneClasses(tone: RaceTone) {
  if (tone === 'open') {
    return 'border-red-500/25 bg-red-500/10 text-red-200'
  }

  if (tone === 'pending') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  }

  if (tone === 'scored') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  }

  return 'border-red-500/20 bg-red-500/10 text-red-200'
}
