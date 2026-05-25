'use client'

import { useActionState } from 'react'
import { Send } from 'lucide-react'
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

function ConditionList({ group }: { group: ManualEmailConditionGroup }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
      <div className="text-sm font-bold text-white">{group.title}</div>
      <div className="mt-3 grid gap-2">
        {group.conditions.map((condition) => (
          <div key={`${group.title}-${condition.label}`} className="grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
            <span
              className={`mt-0.5 inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                condition.passed
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
              }`}
            >
              {condition.passed ? 'Ready' : 'Check'}
            </span>
            <div className="min-w-0">
              <div className="text-sm text-slate-200">{condition.label}</div>
              {condition.detail && <div className="mt-0.5 break-words text-xs text-slate-500">{condition.detail}</div>}
            </div>
          </div>
        ))}
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

  return (
    <section className="space-y-4 rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.48fr)] xl:items-start">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Manual send</div>
          <h2 className="mt-2 text-xl font-black italic tracking-tight text-white">Send selected email</h2>
          <p className="mt-1 text-sm text-slate-400">
            One recipient, one eligible live email.
          </p>
        </div>

        <form action="/admin/notifications" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] sm:items-end">
          <div>
            <label htmlFor="manual-user" className="mb-1.5 block text-sm font-medium text-slate-300">Selected user</label>
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
            <label htmlFor="manual-kind" className="mb-1.5 block text-sm font-medium text-slate-300">Email type</label>
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
            View
          </button>
        </form>
      </div>

      <ConditionList group={conditionGroup} />

      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input type="hidden" name="user_id" value={selectedUserId} />
        <input type="hidden" name="email_kind" value={selectedKind} />
        <div className="text-sm text-slate-500">
          Recipient: <span className="font-semibold text-slate-300">{selectedUserLabel}</span>
        </div>
        <button
          type="submit"
          disabled={pending || !selectedUserId}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          <Send className="h-4 w-4" />
          {pending ? 'Sending...' : 'Send selected email'}
        </button>
      </form>

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
    </section>
  )
}
