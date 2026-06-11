import { createServiceRoleClient } from '@/utils/supabase/service-role'

export type AdminUserLifecycle = {
  lastActivityAt: string | null
  lastLoginAt: string | null
  lastPredictionAt: string | null
}

type PredictionActivityRow = {
  user_id: string
  updated_at?: string | null
}

function getLatestIso(a?: string | null, b?: string | null) {
  if (!a) return b || null
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

export async function getAdminUserLifecycle(profileIds: string[]) {
  if (profileIds.length === 0) {
    return new Map<string, AdminUserLifecycle>()
  }

  try {
    const supabase = createServiceRoleClient()
    const [{ data: authUsersPage, error: authUsersError }, { data: predictionActivity, error: predictionActivityError }] =
      await Promise.all([
        supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabase
          .from('predictions')
          .select('user_id, updated_at')
          .in('user_id', profileIds)
          .order('updated_at', { ascending: false }),
      ])

    if (authUsersError) {
      throw authUsersError
    }

    if (predictionActivityError) {
      throw predictionActivityError
    }

    const lifecycleByUserId = new Map<string, AdminUserLifecycle>()
    const relevantIds = new Set(profileIds)

    for (const authUser of authUsersPage.users) {
      if (!relevantIds.has(authUser.id)) continue

      lifecycleByUserId.set(authUser.id, {
        lastActivityAt: authUser.last_sign_in_at || null,
        lastLoginAt: authUser.last_sign_in_at || null,
        lastPredictionAt: null,
      })
    }

    for (const activity of (predictionActivity || []) as PredictionActivityRow[]) {
      if (!activity.updated_at) continue
      const current = lifecycleByUserId.get(activity.user_id) || {
        lastActivityAt: null,
        lastLoginAt: null,
        lastPredictionAt: null,
      }

      if (!current.lastPredictionAt) {
        current.lastPredictionAt = activity.updated_at
      }

      current.lastActivityAt = getLatestIso(current.lastActivityAt, activity.updated_at)
      lifecycleByUserId.set(activity.user_id, current)
    }

    return lifecycleByUserId
  } catch {
    return new Map<string, AdminUserLifecycle>()
  }
}
