'use server'
import { revalidatePath } from 'next/cache'
import { assertPlatformAdmin } from '@/utils/admin-access'
import { recalculateRaceScores } from '@/utils/race-scoring'

export async function calculateRaceScoresAction(formData: FormData) {
  const raceId = formData.get('race_id') as string
  if (!raceId) throw new Error('Missing race ID')

  const { supabase } = await assertPlatformAdmin()
  await recalculateRaceScores(supabase, raceId)

  revalidatePath(`/admin/races/${raceId}`)
  revalidatePath('/admin')
  revalidatePath(`/leaderboard`)
  revalidatePath('/me/history')
  revalidatePath('/predictions')
  revalidatePath('/season')
  revalidatePath(`/race/${raceId}`)
  revalidatePath(`/race/${raceId}/predict`)
}

export async function repairScoresAndLeaderboardsAction() {
  const { supabase } = await assertPlatformAdmin()

  const [{ data: races }, { data: raceResults }] = await Promise.all([
    supabase
      .from('races')
      .select('id, season, status')
      .in('status', ['completed', 'scored']),
    supabase.from('race_results').select('race_id'),
  ])

  const resultRaceIds = new Set((raceResults || []).map((row) => row.race_id))
  const targetRaces = (races || []).filter((race) => resultRaceIds.has(race.id))
  for (const race of targetRaces) {
    await recalculateRaceScores(supabase, race.id)
  }

  revalidatePath('/admin')
  revalidatePath('/leaderboard')
  revalidatePath('/predictions')
  revalidatePath('/me/history')
  revalidatePath('/season')

  return {
    success: true,
    message:
      targetRaces.length > 0
        ? `Repaired ${targetRaces.length} scored race${targetRaces.length === 1 ? '' : 's'} and refreshed leaderboard totals.`
        : 'No scored races with official results needed repair.',
  }
}
