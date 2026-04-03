import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminAccessContext } from '@/utils/admin-access'
import { recalculateRaceScores } from '@/utils/race-scoring'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const raceId = params.id

  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!access.isPlatformAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await recalculateRaceScores(supabase, raceId)
    return NextResponse.json({ success: true, count: result.predictionsCount })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not recalculate scores' },
      { status: 400 }
    )
  }
}
