import { createServiceRoleClient } from '@/utils/supabase/service-role'

const DEFAULT_RACE_REMINDER_LEAD_HOURS = 24
const PLATFORM_SETTINGS_ID = 'global'

type NotificationSettingsClient = ReturnType<typeof createServiceRoleClient>

export type NotificationTimingProfile = {
  user_id: string
  email?: string | null
  tenant_id?: string | null
}

export type EffectiveNotificationTiming = {
  raceReminderLeadHours: number
  source: 'tenant' | 'platform' | 'fallback'
}

export type PlatformNotificationTiming = {
  raceReminderLeadHours: number
  source: 'platform' | 'fallback'
}

type PlatformSettingRow = {
  race_reminder_lead_hours?: number | null
}

type TenantSettingRow = {
  tenant_id: string
  race_reminder_lead_hours?: number | null
}

function getPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getValidLeadHours(value: number | null | undefined) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 240 ? value : null
}

function isMissingSettingsTable(error: { message?: string; code?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === '42P01' ||
        error.message?.includes('notification_platform_settings') ||
        error.message?.includes('notification_tenant_settings'))
  )
}

export function getFallbackRaceReminderLeadHours() {
  return getPositiveNumber(process.env.RACE_REMINDER_LEAD_HOURS, DEFAULT_RACE_REMINDER_LEAD_HOURS)
}

export function getDefaultNotificationTiming(): EffectiveNotificationTiming {
  return {
    raceReminderLeadHours: getFallbackRaceReminderLeadHours(),
    source: 'fallback',
  }
}

export async function getPlatformNotificationTiming(
  supabase: NotificationSettingsClient
): Promise<PlatformNotificationTiming> {
  const fallbackHours = getFallbackRaceReminderLeadHours()
  const result = await supabase
    .from('notification_platform_settings')
    .select('race_reminder_lead_hours')
    .eq('id', PLATFORM_SETTINGS_ID)
    .maybeSingle()

  if (isMissingSettingsTable(result.error)) {
    return { raceReminderLeadHours: fallbackHours, source: 'fallback' }
  }

  if (result.error) {
    throw new Error(`Failed to load platform notification settings: ${result.error.message}`)
  }

  const platformLeadHours = getValidLeadHours(
    (result.data as PlatformSettingRow | null)?.race_reminder_lead_hours
  )

  return platformLeadHours
    ? { raceReminderLeadHours: platformLeadHours, source: 'platform' }
    : { raceReminderLeadHours: fallbackHours, source: 'fallback' }
}

export async function getEffectiveNotificationTimingForProfiles(
  supabase: NotificationSettingsClient,
  profiles: NotificationTimingProfile[]
) {
  const fallbackHours = getFallbackRaceReminderLeadHours()
  const tenantIds = [...new Set(profiles.flatMap((profile) => (profile.tenant_id ? [profile.tenant_id] : [])))]

  if (profiles.length === 0) {
    return new Map<string, EffectiveNotificationTiming>()
  }

  const [tenantSettingsResult, platformSettingResult] = await Promise.all([
    tenantIds.length > 0
      ? supabase
          .from('notification_tenant_settings')
          .select('tenant_id, race_reminder_lead_hours')
          .in('tenant_id', tenantIds)
      : Promise.resolve({ data: [] as TenantSettingRow[], error: null }),
    supabase
      .from('notification_platform_settings')
      .select('race_reminder_lead_hours')
      .eq('id', PLATFORM_SETTINGS_ID)
      .maybeSingle(),
  ])

  if (isMissingSettingsTable(tenantSettingsResult.error) || isMissingSettingsTable(platformSettingResult.error)) {
    return new Map(profiles.map((profile) => [profile.user_id, getDefaultNotificationTiming()]))
  }

  if (tenantSettingsResult.error) {
    throw new Error(`Failed to load tenant notification settings: ${tenantSettingsResult.error.message}`)
  }

  if (platformSettingResult.error) {
    throw new Error(`Failed to load platform notification settings: ${platformSettingResult.error.message}`)
  }

  const tenantSettings = new Map(
    ((tenantSettingsResult.data || []) as TenantSettingRow[])
      .map((setting) => [setting.tenant_id, getValidLeadHours(setting.race_reminder_lead_hours)] as const)
      .filter((setting): setting is readonly [string, number] => Boolean(setting[1]))
  )
  const platformLeadHours = getValidLeadHours(
    (platformSettingResult.data as PlatformSettingRow | null)?.race_reminder_lead_hours
  )

  return new Map(
    profiles.map((profile) => {
      const tenantValue = profile.tenant_id ? tenantSettings.get(profile.tenant_id) : undefined
      const timing: EffectiveNotificationTiming = tenantValue
        ? { raceReminderLeadHours: tenantValue, source: 'tenant' }
        : platformLeadHours
          ? { raceReminderLeadHours: platformLeadHours, source: 'platform' }
          : { raceReminderLeadHours: fallbackHours, source: 'fallback' }

      return [profile.user_id, timing]
    })
  )
}

export async function getEffectiveNotificationTimingForProfile(
  supabase: NotificationSettingsClient,
  profile: NotificationTimingProfile
) {
  const settings = await getEffectiveNotificationTimingForProfiles(supabase, [profile])
  return settings.get(profile.user_id) || getDefaultNotificationTiming()
}
