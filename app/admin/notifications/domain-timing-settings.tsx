'use client'

import { useActionState } from 'react'
import { Clock3 } from 'lucide-react'
import {
  saveDomainNotificationTiming,
  type NotificationTimingActionState,
} from '@/app/actions/admin-notifications'
import { FormActionButton } from '@/components/ui/form-action-button'

type DomainTimingRow = {
  domain: string
  raceReminderLeadHours: number
  source: string
  accountCount: number
}

type DomainTimingSettingsProps = {
  rows: DomainTimingRow[]
  fallbackHours: number
}

const initialState: NotificationTimingActionState = {}

function DomainTimingForm({ row }: { row: DomainTimingRow }) {
  const [state, formAction] = useActionState(saveDomainNotificationTiming, initialState)

  return (
    <form action={formAction} className="grid gap-3 border-b border-white/5 p-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_10rem_auto] lg:items-center">
      <input type="hidden" name="domain" value={row.domain} />
      <div className="min-w-0">
        <div className="break-words font-semibold text-white">{row.domain}</div>
        <div className="mt-1 text-sm text-slate-500">
          {row.accountCount} account{row.accountCount === 1 ? '' : 's'} · {row.source === 'domain' ? 'custom default' : 'fallback default'}
        </div>
        {state.message && (
          <div className={`mt-2 text-xs ${state.status === 'success' ? 'text-emerald-200' : 'text-amber-200'}`}>
            {state.message}
          </div>
        )}
      </div>
      <label className="min-w-0">
        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Hours</span>
        <input
          name="race_reminder_lead_hours"
          type="number"
          min={1}
          max={240}
          defaultValue={row.raceReminderLeadHours}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-red-500"
        />
      </label>
      <FormActionButton idleLabel="Save" pendingLabel="Saving..." tone="secondary" className="lg:w-auto" />
    </form>
  )
}

export function DomainTimingSettings({ rows, fallbackHours }: DomainTimingSettingsProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-card shadow-xl">
      <div className="border-b border-white/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Reminder timing</div>
            <h2 className="mt-2 text-xl font-black italic tracking-tight text-white">Domain defaults</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Set the default prediction reminder window for each email domain. Group overrides take priority when a group admin sets one.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-300">
            <Clock3 className="h-4 w-4 text-red-400" />
            Fallback {fallbackHours}h
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-5 text-sm text-slate-400">No account email domains found yet.</div>
      ) : (
        <div>{rows.map((row) => <DomainTimingForm key={row.domain} row={row} />)}</div>
      )}
    </section>
  )
}
