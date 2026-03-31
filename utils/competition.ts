export type CompetitionStanding = {
  user_id: string
  total_points: number
  exact_hits: number
  races_scored: number
}

export function sortCompetitionStandings<T extends CompetitionStanding>(entries: T[]) {
  return [...entries].sort((left, right) => {
    if (right.total_points !== left.total_points) {
      return right.total_points - left.total_points
    }

    if (right.exact_hits !== left.exact_hits) {
      return right.exact_hits - left.exact_hits
    }

    if (right.races_scored !== left.races_scored) {
      return right.races_scored - left.races_scored
    }

    return left.user_id.localeCompare(right.user_id)
  })
}

export function getCompetitionRank<T extends CompetitionStanding>(entries: T[], userId: string) {
  const index = entries.findIndex((entry) => entry.user_id === userId)
  return index >= 0 ? index + 1 : null
}
