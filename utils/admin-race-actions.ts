import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'

type ActionRace = {
  id: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
}

export type PlatformRaceActionState =
  | 'needs_results'
  | 'bonus_follow_up'
  | 'weekend_live'
  | 'needs_setup'
  | 'done'

export type TenantRaceActionState =
  | 'needs_bonus_answers'
  | 'weekend_live'
  | 'awaiting_results'
  | 'race_readiness'
  | 'scored_review'

export function getPlatformRaceActionState(
  race: ActionRace,
  pendingBonusQuestionCount: number
): PlatformRaceActionState {
  const status = getEffectiveRaceStatus(race)

  if (status === 'completed') return 'needs_results'
  if (status === 'scored' && pendingBonusQuestionCount > 0) return 'bonus_follow_up'
  if (status === 'locked') return 'weekend_live'
  if (status === 'upcoming') return 'needs_setup'
  return 'done'
}

export function getPlatformRaceActionPriority(state: PlatformRaceActionState) {
  if (state === 'needs_results') return 0
  if (state === 'bonus_follow_up') return 1
  if (state === 'weekend_live') return 2
  if (state === 'needs_setup') return 3
  return 4
}

export function getPlatformRaceActionLabel(state: PlatformRaceActionState) {
  if (state === 'needs_results') return 'NEEDS RESULTS'
  if (state === 'bonus_follow_up') return 'BONUS FOLLOW-UP'
  if (state === 'weekend_live') return 'LIVE WEEKEND'
  if (state === 'needs_setup') return 'NEXT SETUP'
  return 'DONE'
}

export function getPlatformRaceActionBadgeClasses(state: PlatformRaceActionState) {
  if (state === 'needs_results') return 'bg-red-500/15 text-red-300 border-red-500/30'
  if (state === 'bonus_follow_up') return 'bg-amber-500/15 text-amber-200 border-amber-500/30'
  if (state === 'weekend_live') return 'bg-orange-500/15 text-orange-200 border-orange-500/30'
  if (state === 'needs_setup') return 'bg-sky-500/15 text-sky-200 border-sky-500/30'
  return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
}

export function getTenantRaceActionState(
  race: ActionRace,
  pendingBonusQuestionCount: number
): TenantRaceActionState {
  const status = getEffectiveRaceStatus(race)

  if (status !== 'upcoming' && pendingBonusQuestionCount > 0) return 'needs_bonus_answers'
  if (status === 'locked') return 'weekend_live'
  if (status === 'completed') return 'awaiting_results'
  if (status === 'upcoming') return 'race_readiness'
  return 'scored_review'
}

export function getTenantRaceActionPriority(state: TenantRaceActionState) {
  if (state === 'needs_bonus_answers') return 0
  if (state === 'weekend_live') return 1
  if (state === 'awaiting_results') return 2
  if (state === 'race_readiness') return 3
  return 4
}

export function getTenantRaceActionLabel(state: TenantRaceActionState) {
  if (state === 'needs_bonus_answers') return 'ANSWERS NEEDED'
  if (state === 'weekend_live') return 'WEEKEND LIVE'
  if (state === 'awaiting_results') return 'RESULTS PENDING'
  if (state === 'race_readiness') return 'RACE READINESS'
  return 'SCORED REVIEW'
}

export function getTenantRaceActionBadgeClasses(state: TenantRaceActionState) {
  if (state === 'needs_bonus_answers') return 'bg-red-500/15 text-red-200 border-red-500/30'
  if (state === 'weekend_live') return 'bg-amber-500/15 text-amber-200 border-amber-500/30'
  if (state === 'awaiting_results') return 'bg-orange-500/15 text-orange-200 border-orange-500/30'
  if (state === 'race_readiness') return 'bg-sky-500/15 text-sky-200 border-sky-500/30'
  return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
}
