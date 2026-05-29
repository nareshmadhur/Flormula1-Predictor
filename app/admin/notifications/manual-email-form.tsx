'use client'

import { useActionState, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Send, ShieldAlert } from 'lucide-react'
import {
  sendAdminNotificationEmail,
  type AdminNotificationSendActionState,
} from '@/app/actions/admin-notifications'
import type { ManualLifecycleEmailKind } from '@/utils/race-notifications'

type ManualEmailUserOption = {
  id: string
  label: string
}

type ManualEmailCondition = {
  label: string
  passed: boolean
  detail?: string
  kind: 'required' | 'rule'
}

type ManualEmailConditionGroup = {
  title: string
  conditions: ManualEmailCondition[]
}

type ManualEmailFormProps = {
  users: ManualEmailUserOption[]
  selectedUserId: string
  selectedUserLabel: string
  selectedKind: ManualLifecycleEmailKind
  conditionGroup: ManualEmailConditionGroup
}

const initialState: AdminNotificationSendActionState = {}

function getConditionStatus(condition: ManualEmailCondition) {
  if (condition.passed) return 'Ready'
  return condition.kind === 'required' ? 'Blocked' : 'Override'
}

function getConditionClasses(condition: ManualEmailCondition) {
  if (condition.passed) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
  if (condition.kind === 'required') return 'border-red-500/20 bg-red-500/10 text-red-200'
  return 'border-amber-500/20 bg-amber-500/10 text-amber-200'
}

function ConditionList({ group }: { group: ManualEmailConditionGroup }) {
  const requiredConditions = group.conditions.filter((condition) => condition.kind === 'required')
  const ruleConditions = group.conditions.filter((condition) => condition.kind === 'rule')

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          Required checks
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          These protect deliverability and user consent. Blocked items must be fixed before sending.
        </p>
        <div className="mt-3 grid gap-2">
          {requiredConditions.map((condition) => (
            <ConditionRow key={`required-${condition.label}`} condition={condition} />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <ShieldAlert className="h-4 w-4 text-amber-300" />
          Normal send rules
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          These match the automatic flow. Override items are allowed only after explicit confirmation.
        </p>
        <div className="mt-3 grid gap-2">
          {ruleConditions.map((condition) => (
            <ConditionRow key={`rule-${condition.label}`} condition={condition} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ConditionRow({ condition }: { condition: ManualEmailCondition }) {
  return (
    <div className="grid gap-2 rounded-xl border border-white/5 bg-black/25 px-3 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
      <span
        className={`inline-flex w-fit items-center justify-center rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${getConditionClasses(condition)}`}
      >
        {getConditionStatus(condition)}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-100">{condition.label}</div>
        {condition.detail && <div className="mt-0.5 break-words text-xs leading-5 text-slate-500">{condition.detail}</div>}
      </div>
    </div>
  )
}

export function ManualEmailForm({
  users,
  selectedUserId,
  selectedUserLabel,
  selectedKind,
  conditionGroup,
}: ManualEmailFormProps) {
  const [state, formAction, pending] = useActionState(
    sendAdminNotificationEmail,
    initialState
  )
  const [overrideRules, setOverrideRules] = useState(false)
  const { blockedCount, overrideCount, readyCount } = useMemo(() => {
    const blocked = conditionGroup.conditions.filter(
      (condition) => !condition.passed && condition.kind === 'required'
    ).length
    const override = conditionGroup.conditions.filter(
      (condition) => !condition.passed && condition.kind === 'rule'
    ).length

    return {
      blockedCount: blocked,
      overrideCount: override,
      readyCount: conditionGroup.conditions.length - blocked - override,
    }
  }, [conditionGroup])
  const sendDisabled = pending || !selectedUserId || blockedCount > 0 || (overrideCount > 0 && !overrideRules)
  const buttonLabel = pending
    ? 'Sending...'
    : blockedCount > 0
      ? 'Resolve blocked checks'
      : overrideCount > 0 && !overrideRules
        ? 'Confirm override to send'
        : overrideRules
          ? 'Send with override'
          : 'Send email'

  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-card shadow-xl">
      <div className="border-b border-white/5 p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(380px,0.7fr)] xl:items-start">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Manual send</div>
            <h2 className="mt-2 text-xl font-black italic tracking-tight text-white">Send selected email</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Choose the recipient and email type, review what the automatic flow would check, then send or override the normal rules.
            </p>
          </div>

          <form action="/admin/notifications" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] sm:items-end">
            <div>
              <label htmlFor="manual-user" className="mb-1.5 block text-sm font-medium text-slate-300">Recipient</label>
              <select
                id="manual-user"
                name="user"
                defaultValue={selectedUserId}
                className="w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-red-500"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="manual-kind" className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
              <select
                id="manual-kind"
                name="kind"
                defaultValue={selectedKind}
                className="w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-red-500"
              >
                <option value="prediction">Prediction reminder</option>
                <option value="results">Results recap</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10"
            >
              Review
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
        <div className="border-b border-white/5 p-5 xl:border-b-0 xl:border-r">
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/8 px-3 py-2">
              <div className="text-2xl font-black italic text-white">{readyCount}</div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Ready</div>
            </div>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/8 px-3 py-2">
              <div className="text-2xl font-black italic text-white">{overrideCount}</div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Override</div>
            </div>
            <div className="rounded-xl border border-red-500/15 bg-red-500/8 px-3 py-2">
              <div className="text-2xl font-black italic text-white">{blockedCount}</div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-200">Blocked</div>
            </div>
          </div>

          <ConditionList group={conditionGroup} />
        </div>

        <form action={formAction} className="flex flex-col gap-4 p-5">
          <input type="hidden" name="user_id" value={selectedUserId} />
          <input type="hidden" name="email_kind" value={selectedKind} />

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Send step</div>
            <div className="mt-2 break-words text-sm font-semibold text-slate-200">{conditionGroup.title}</div>
            <div className="mt-1 break-words text-sm text-slate-500">{selectedUserLabel}</div>
          </div>

          {blockedCount > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Blocked checks cannot be overridden. Fix them first, then review again.</span>
              </div>
            </div>
          )}

          {overrideCount > 0 && blockedCount === 0 && (
            <label className="flex cursor-pointer gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
              <input
                type="checkbox"
                name="override_rules"
                checked={overrideRules}
                onChange={(event) => setOverrideRules(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-amber-300 bg-black/40 text-red-600"
              />
              <span>
                Override the normal send rules for this one email. This can resend or send outside the usual timing, but it still respects blocked safety checks.
              </span>
            </label>
          )}

          {overrideCount === 0 && blockedCount === 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
              All checks are ready. This email matches the normal send rules.
            </div>
          )}

          <button
            type="submit"
            disabled={sendDisabled}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            <Send className="h-4 w-4" />
            {buttonLabel}
          </button>

          {state.message && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                state.status === 'success'
                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                  : 'border border-amber-500/20 bg-amber-500/10 text-amber-100'
              }`}
            >
              {state.message}
            </div>
          )}
        </form>
      </div>
    </section>
  )
}
