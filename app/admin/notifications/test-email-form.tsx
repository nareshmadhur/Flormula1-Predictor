'use client'

import { useActionState } from 'react'
import { Send } from 'lucide-react'
import {
  sendAdminNotificationTestEmails,
  type AdminNotificationTestActionState,
} from '@/app/actions/admin-notifications'

type TestEmailUserOption = {
  id: string
  label: string
}

type TestEmailCondition = {
  label: string
  passed: boolean
  detail?: string
}

type TestEmailConditionGroup = {
  title: string
  conditions: TestEmailCondition[]
}

type TestEmailFormProps = {
  users: TestEmailUserOption[]
  selectedUserId: string
  selectedUserLabel: string
  conditionGroups: TestEmailConditionGroup[]
}

const initialState: AdminNotificationTestActionState = {}

function ConditionList({ group }: { group: TestEmailConditionGroup }) {
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

export function TestEmailForm({
  users,
  selectedUserId,
  selectedUserLabel,
  conditionGroups,
}: TestEmailFormProps) {
  const [state, formAction, pending] = useActionState(
    sendAdminNotificationTestEmails,
    initialState
  )

  return (
    <section className="space-y-4 rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.4fr)] lg:items-start">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Test emails</div>
          <h2 className="mt-2 text-xl font-black italic tracking-tight text-white">Send a controlled check</h2>
          <p className="mt-1 text-sm text-slate-400">
            Pick a user and send the eligible prediction and results test emails to that account.
          </p>
        </div>

        <form action="/admin/notifications" className="space-y-2">
          <label htmlFor="test-user" className="text-sm font-medium text-slate-300">Selected user</label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select
              id="test-user"
              name="user"
              defaultValue={selectedUserId}
              className="min-w-0 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-red-500"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10"
            >
              View
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {conditionGroups.map((group) => (
          <ConditionList key={group.title} group={group} />
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input type="hidden" name="user_id" value={selectedUserId} />
        <div className="text-sm text-slate-500">
          Test recipient: <span className="font-semibold text-slate-300">{selectedUserLabel}</span>
        </div>
        <button
          type="submit"
          disabled={pending || !selectedUserId}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          <Send className="h-4 w-4" />
          {pending ? 'Sending...' : 'Send eligible test emails'}
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
