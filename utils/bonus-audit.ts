import { createClient } from '@/utils/supabase/server'
import { getProfileDisplayName } from '@/utils/profile-name'
import type { BonusAuditEntry } from '@/components/ui/bonus-audit-log'

type BonusAuditClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>

type BonusQuestionAuditRow = {
  id: string
  entity_type: 'question' | 'option'
  action: string
  tenant_id?: string | null
  question_text?: string | null
  option_label?: string | null
  points?: number | null
  changed_by?: string | null
  changed_at: string
}

type TenantBonusAnswerAuditRow = {
  id: string
  tenant_id?: string | null
  changed_by?: string | null
  changed_at: string
}

type TenantRow = {
  id: string
  name: string
}

type ProfileRow = {
  id: string
  display_name?: string | null
  email?: string | null
}

function isMissingAuditTable(error: { message?: string | null } | null) {
  return Boolean(error?.message?.includes('bonus_question_audit'))
}

function getQuestionAuditSubject(row: BonusQuestionAuditRow, tenantName: string | null) {
  const scope = tenantName ? `${tenantName}: ` : ''

  if (row.entity_type === 'option') {
    return `${scope}${row.option_label || 'Bonus option'}`
  }

  return `${scope}${row.question_text || 'Bonus question'}`
}

function getQuestionAuditDetail(row: BonusQuestionAuditRow) {
  if (row.entity_type === 'option') return 'Bonus option changed.'
  if (typeof row.points === 'number') return `${row.points} point${row.points === 1 ? '' : 's'}`
  return null
}

export async function getRaceBonusAuditEntries(
  supabase: BonusAuditClient,
  raceId: string,
  limit = 12
): Promise<BonusAuditEntry[]> {
  const [questionAuditResult, answerAuditResult] = await Promise.all([
    supabase
      .from('bonus_question_audit')
      .select('id, entity_type, action, tenant_id, question_text, option_label, points, changed_by, changed_at')
      .eq('race_id', raceId)
      .order('changed_at', { ascending: false })
      .limit(limit),
    supabase
      .from('tenant_bonus_answer_audit')
      .select('id, tenant_id, changed_by, changed_at')
      .eq('race_id', raceId)
      .order('changed_at', { ascending: false })
      .limit(limit),
  ])

  if (questionAuditResult.error && !isMissingAuditTable(questionAuditResult.error)) {
    throw new Error(questionAuditResult.error.message || 'Could not load bonus question audit.')
  }

  const questionRows = questionAuditResult.error
    ? []
    : ((questionAuditResult.data || []) as BonusQuestionAuditRow[])
  const answerRows = answerAuditResult.error
    ? []
    : ((answerAuditResult.data || []) as TenantBonusAnswerAuditRow[])
  const tenantIds = Array.from(
    new Set(
      [...questionRows, ...answerRows]
        .map((row) => row.tenant_id)
        .filter((tenantId): tenantId is string => Boolean(tenantId))
    )
  )
  const profileIds = Array.from(
    new Set(
      [...questionRows, ...answerRows]
        .map((row) => row.changed_by)
        .filter((profileId): profileId is string => Boolean(profileId))
    )
  )

  const [{ data: tenants }, { data: profiles }] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from('tenants').select('id, name').in('id', tenantIds)
      : { data: [] as TenantRow[] },
    profileIds.length > 0
      ? supabase.from('profiles').select('id, display_name, email').in('id', profileIds)
      : { data: [] as ProfileRow[] },
  ])

  const tenantById = new Map(((tenants || []) as TenantRow[]).map((tenant) => [tenant.id, tenant]))
  const profileById = new Map(((profiles || []) as ProfileRow[]).map((profile) => [profile.id, profile]))

  return [
    ...questionRows.map((row) => {
      const tenantName = row.tenant_id ? tenantById.get(row.tenant_id)?.name || null : null
      const profile = row.changed_by ? profileById.get(row.changed_by) : null

      return {
        id: `question-${row.id}`,
        action: row.action,
        subject: getQuestionAuditSubject(row, tenantName),
        detail: getQuestionAuditDetail(row),
        changedAt: row.changed_at,
        changedBy: profile ? getProfileDisplayName(profile.display_name, profile.email) : null,
      }
    }),
    ...answerRows.map((row) => {
      const tenantName = row.tenant_id ? tenantById.get(row.tenant_id)?.name || null : null
      const profile = row.changed_by ? profileById.get(row.changed_by) : null

      return {
        id: `answers-${row.id}`,
        action: 'ANSWERS',
        subject: tenantName ? `${tenantName}: bonus answers` : 'Bonus answers',
        detail: 'Correct bonus answers changed and scores were refreshed.',
        changedAt: row.changed_at,
        changedBy: profile ? getProfileDisplayName(profile.display_name, profile.email) : null,
      }
    }),
  ]
    .sort((left, right) => new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime())
    .slice(0, limit)
}
