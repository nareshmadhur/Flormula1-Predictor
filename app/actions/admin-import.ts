'use server'

import { revalidatePath } from 'next/cache'
import { assertPlatformAdmin } from '@/utils/admin-access'
import {
  buildOpenF1ScheduleReview,
  fetchOpenF1SeasonSchedule,
  type ExistingRaceForImport,
  type OpenF1CircuitLookup,
} from '@/utils/openf1'
import type { ScheduleImportActionState } from '@/app/admin/schedule/action-state'

function stripSourceMetadata<T extends Record<string, unknown>>(payload: T) {
  const clone = { ...payload }
  delete clone.schedule_source
  delete clone.schedule_source_url
  delete clone.schedule_synced_at
  return clone
}

async function updateRaceWithSourceFallback(
  supabase: Awaited<ReturnType<typeof assertPlatformAdmin>>['supabase'],
  raceId: string,
  payload: Record<string, unknown>
) {
  const attempt = await supabase.from('races').update(payload).eq('id', raceId)
  if (!attempt.error) return attempt

  if (attempt.error.code === 'PGRST204' && attempt.error.message?.includes('schedule_source')) {
    return supabase.from('races').update(stripSourceMetadata(payload)).eq('id', raceId)
  }

  return attempt
}

async function insertRaceWithSourceFallback(
  supabase: Awaited<ReturnType<typeof assertPlatformAdmin>>['supabase'],
  payload: Record<string, unknown>
) {
  const attempt = await supabase.from('races').insert(payload).select('id').single()
  if (!attempt.error) return attempt

  if (attempt.error.code === 'PGRST204' && attempt.error.message?.includes('schedule_source')) {
    return supabase.from('races').insert(stripSourceMetadata(payload)).select('id').single()
  }

  return attempt
}

export async function applyOpenF1ScheduleImport(
  _previousState: ScheduleImportActionState,
  formData: FormData
): Promise<ScheduleImportActionState> {
  const season = Number(formData.get('season'))

  if (!Number.isFinite(season) || season < 2020) {
    return {
      status: 'error',
      message: 'Choose a valid season before applying the import.',
    }
  }

  try {
    const { supabase } = await assertPlatformAdmin()
    const [{ data: existingRaces }, { data: circuits }] = await Promise.all([
      supabase
        .from('races')
        .select(
          'id, season, round, race_name, circuit_id, status, race_start_at, prediction_lock_at, fp1_at, fp2_at, fp3_at, quali_at, sprint_at, sprint_quali_at, external_race_key'
        )
        .eq('season', season)
        .order('round', { ascending: true }),
      supabase.from('circuits').select('id, name, city, country, emoji').order('name'),
    ])

    const importedRaces = await fetchOpenF1SeasonSchedule(season)
    const reviewRows = buildOpenF1ScheduleReview(
      importedRaces,
      (existingRaces || []) as ExistingRaceForImport[],
      (circuits || []) as OpenF1CircuitLookup[]
    )

    const syncedAt = new Date().toISOString()
    let updatedCount = 0
    let createdCount = 0
    let skippedCount = 0
    let needsMappingCount = 0

    for (const row of reviewRows) {
      if (row.action === 'update' && row.existingRace) {
        const payload = {
          race_name: row.imported.raceName,
          circuit_id: row.circuitMatch?.id || row.existingRace.circuit_id,
          race_start_at: row.imported.raceStartAt,
          prediction_lock_at: row.imported.predictionLockAt,
          fp1_at: row.imported.fp1At,
          fp2_at: row.imported.fp2At,
          fp3_at: row.imported.fp3At,
          quali_at: row.imported.qualiAt,
          sprint_at: row.imported.sprintAt,
          sprint_quali_at: row.imported.sprintQualiAt,
          external_race_key: String(row.imported.meetingKey),
          schedule_source: 'openf1',
          schedule_source_url: row.imported.sourceUrl,
          schedule_synced_at: syncedAt,
        }

        const { error } = await updateRaceWithSourceFallback(supabase, row.existingRace.id, payload)
        if (error) {
          throw new Error(`Failed to sync ${row.imported.raceName}`)
        }

        updatedCount += 1
        continue
      }

      if (row.action === 'create' && row.circuitMatch) {
        const payload = {
          season: row.imported.season,
          round: row.imported.round,
          race_name: row.imported.raceName,
          circuit_id: row.circuitMatch.id,
          race_start_at: row.imported.raceStartAt,
          prediction_lock_at: row.imported.predictionLockAt,
          fp1_at: row.imported.fp1At,
          fp2_at: row.imported.fp2At,
          fp3_at: row.imported.fp3At,
          quali_at: row.imported.qualiAt,
          sprint_at: row.imported.sprintAt,
          sprint_quali_at: row.imported.sprintQualiAt,
          status: 'upcoming',
          external_race_key: String(row.imported.meetingKey),
          schedule_source: 'openf1',
          schedule_source_url: row.imported.sourceUrl,
          schedule_synced_at: syncedAt,
        }

        const { data, error } = await insertRaceWithSourceFallback(supabase, payload)
        if (error) {
          throw new Error(`Failed to add ${row.imported.raceName}`)
        }

        if (data?.id) {
          revalidatePath(`/admin/races/${data.id}`)
          revalidatePath(`/race/${data.id}`)
        }

        createdCount += 1
        continue
      }

      skippedCount += 1
      if (!row.existingRace && !row.circuitMatch) {
        needsMappingCount += 1
      }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/schedule')
    revalidatePath('/')
    revalidatePath('/season')
    revalidatePath('/leaderboard')
    revalidatePath('/predictions')

    return {
      status: 'success',
      message:
        needsMappingCount > 0
          ? `Synced ${updatedCount}, added ${createdCount}, and left ${needsMappingCount} weekend${needsMappingCount === 1 ? '' : 's'} for manual circuit mapping.`
          : `Synced ${updatedCount} race${updatedCount === 1 ? '' : 's'} and added ${createdCount} new weekend${createdCount === 1 ? '' : 's'}. ${skippedCount} already matched the app.`,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Schedule import failed.',
    }
  }
}
