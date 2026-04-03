import type { RaceStatus } from '@/utils/race-status'

export function getAdminRaceStatusLabel(status: RaceStatus) {
  if (status === 'completed') return 'NEEDS SCORING'
  if (status === 'locked') return 'LIVE WEEKEND'
  if (status === 'upcoming') return 'OPEN'
  if (status === 'scored') return 'SCORED'
  return 'CANCELLED'
}

export function getAdminRaceStatusClasses(status: RaceStatus) {
  if (status === 'completed') {
    return 'text-red-300'
  }

  if (status === 'locked') {
    return 'text-amber-300'
  }

  if (status === 'upcoming') {
    return 'text-sky-300'
  }

  if (status === 'scored') {
    return 'text-green-400'
  }

  return 'text-slate-400'
}

export function getAdminRaceStatusBadgeClasses(status: RaceStatus) {
  if (status === 'completed') {
    return 'bg-red-500/15 text-red-300 border-red-500/30'
  }

  if (status === 'locked') {
    return 'bg-amber-500/15 text-amber-200 border-amber-500/30'
  }

  if (status === 'scored') {
    return 'bg-green-500/20 text-green-400 border-green-500/30'
  }

  if (status === 'cancelled') {
    return 'bg-slate-700/40 text-slate-300 border-slate-500/30'
  }

  return 'bg-sky-500/15 text-sky-200 border-sky-500/30'
}
