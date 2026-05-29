import { createServiceRoleClient } from '@/utils/supabase/service-role'

const DEFAULT_RACE_REMINDER_LEAD_HOURS = 24

type NotificationSettingsClient = ReturnType<typeof createServiceRoleClient>

export type NotificationTimingProfile = {
  user_id: string
  email?: string | null
  tenant_id?: string | null
}

export type EffectiveNotificationTiming = {
  raceReminderLeadHours: number
  source: 'tenant' | 'domain' | 'fallback'
  domain: string | null
}

type DomainSettingRow = {
  domain: string
  race_reminder_lead_hours: number
}

type TenantSettingRow = {
  tenant_id: string
  race_reminder_lead_hours?: number | null
}

function getPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function isMissingSettingsTable(error: { message?: string; code?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === '42P01' ||
        error.message?.includes('notification_domain_settings') ||
        error.message?.includes('notification_tenant_settings'))
  )
}

export function getFallbackRaceReminderLeadHours() {
  return getPositiveNumber(process.env.RACE_REMINDER_LEAD_HOURS, DEFAULT_RACE_REMINDER_LEAD_HOURS)
}

export function normalizeEmailDomain(email: string | null | undefined) {
  const value = email?.trim().toLowerCase()
  if (!value || !value.includes('@')) return null

  const domain = value.split('@').pop()?.trim() || ''
  return domain && domain.includes('.') ? domain : null
}

export function normalizeSettingsDomain(value: string | null | undefined) {
  const raw = value?.trim().toLowerCase().replace(/^@+/, '') || ''
  return raw && raw.includes('.') && !raw.includes('@') && !/\s/.test(raw) ? raw : null
}

export function getDefaultNotificationTiming(domain: string | null = null): EffectiveNotificationTiming {
  return {
    raceReminderLeadHours: getFallbackRaceReminderLeadHours(),
    source: 'fallback',
    domain,
  }
}

export async function getEffectiveNotificationTimingForProfiles(
  supabase: NotificationSettingsClient,
  profiles: NotificationTimingProfile[]
) {
  const fallbackHours = getFallbackRaceReminderLeadHours()
  const tenantIds = [...new Set(profiles.flatMap((profile) => (profile.tenant_id ? [profile.tenant_id] : [])))]
  const domains = [
    ...new Set(profiles.flatMap((profile) => {
      const domain = normalizeEmailDomain(profile.email)
      return domain ? [domain] : []
    })),
  ]

  const [tenantSettingsResult, domainSettingsResult] = await Promise.all([
    tenantIds.length > 0
      ? supabase
          .from('notification_tenant_settings')
          .select('tenant_id, race_reminder_lead_hours')
          .in('tenant_id', tenantIds)
      : Promise.resolve({ data: [] as TenantSettingRow[], error: null }),
    domains.length > 0
      ? supabase
          .from('notification_domain_settings')
          .select('domain, race_reminder_lead_hours')
          .in('domain', domains)
      : Promise.resolve({ data: [] as DomainSettingRow[], error: null }),
  ])

  if (isMissingSettingsTable(tenantSettingsResult.error) || isMissingSettingsTable(domainSettingsResult.error)) {
    return new Map(
      profiles.map((profile) => [
        profile.user_id,
        getDefaultNotificationTiming(normalizeEmailDomain(profile.email)),
      ])
    )
  }

  if (tenantSettingsResult.error) {
    throw new Error(`Failed to load tenant notification settings: ${tenantSettingsResult.error.message}`)
  }

  if (domainSettingsResult.error) {
    throw new Error(`Failed to load domain notification settings: ${domainSettingsResult.error.message}`)
  }

  const tenantSettings = new Map(
    ((tenantSettingsResult.data || []) as TenantSettingRow[])
      .filter((setting) => setting.race_reminder_lead_hours)
      .map((setting) => [setting.tenant_id, setting.race_reminder_lead_hours as number])
  )
  const domainSettings = new Map(
    ((domainSettingsResult.data || []) as DomainSettingRow[]).map((setting) => [
      setting.domain,
      setting.race_reminder_lead_hours,
    ])
  )

  return new Map(
    profiles.map((profile) => {
      const domain = normalizeEmailDomain(profile.email)
      const tenantValue = profile.tenant_id ? tenantSettings.get(profile.tenant_id) : undefined
      const domainValue = domain ? domainSettings.get(domain) : undefined
      const timing: EffectiveNotificationTiming = tenantValue
        ? { raceReminderLeadHours: tenantValue, source: 'tenant', domain }
        : domainValue
          ? { raceReminderLeadHours: domainValue, source: 'domain', domain }
          : { raceReminderLeadHours: fallbackHours, source: 'fallback', domain }

      return [profile.user_id, timing]
    })
  )
}

export async function getEffectiveNotificationTimingForProfile(
  supabase: NotificationSettingsClient,
  profile: NotificationTimingProfile
) {
  const settings = await getEffectiveNotificationTimingForProfiles(supabase, [profile])
  return settings.get(profile.user_id) || getDefaultNotificationTiming(normalizeEmailDomain(profile.email))
}
