'use client'

import { useActionState } from 'react'
import { Clock3 } from 'lucide-react'
import {
  clearTenantNotificationTiming,
  saveTenantNotificationTiming,
  type NotificationTimingActionState,
} from '@/app/actions/admin-notifications'
import { FormActionButton } from '@/components/ui/form-action-button'

type TenantNotificationTimingPanelProps = {
  groupName: string
  currentLeadHoursLabel: string
  defaultLeadHours: number
  overrideLeadHours?: number | null
  domainSummary: string
}

const initialState: NotificationTimingActionState = {}

export function TenantNotificationTimingPanel({
  groupName,
  currentLeadHoursLabel,
  defaultLeadHours,
  overrideLeadHours,
  domainSummary,
}: TenantNotificationTimingPanelProps) {
  const [saveState, saveAction] = useActionState(saveTenantNotificationTiming, initialState)
  const [clearState, clearAction] = useActionState(clearTenantNotificationTiming, initialState)
  const hasOverride = Boolean(overrideLeadHours)

  return (
    <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            <Clock3 className="h-4 w-4 text-red-400" />
            Reminder timing
          </div>
          <h2 className="mt-2 text-2xl font-black italic tracking-tight text-white">
            {currentLeadHoursLabel}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {hasOverride
              ? `${groupName} uses its own reminder window.`
              : `${groupName} follows platform defaults by member email domain.`}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{domainSummary}</p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
          <form action={saveAction} className="space-y-3">
            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Group override
              </span>
              <input
                name="race_reminder_lead_hours"
                type="number"
                min={1}
                max={240}
                defaultValue={overrideLeadHours || defaultLeadHours}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-red-500"
              />
            </label>
            <FormActionButton idleLabel={hasOverride ? 'Update override' : 'Set override'} pendingLabel="Saving..." />
            {saveState.message && (
              <div className={`text-sm ${saveState.status === 'success' ? 'text-emerald-200' : 'text-amber-200'}`}>
                {saveState.message}
              </div>
            )}
          </form>

          {hasOverride && (
            <form action={clearAction} className="mt-3">
              <FormActionButton idleLabel="Use platform default" pendingLabel="Clearing..." tone="secondary" />
              {clearState.message && (
                <div className={`mt-2 text-sm ${clearState.status === 'success' ? 'text-emerald-200' : 'text-amber-200'}`}>
                  {clearState.message}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
