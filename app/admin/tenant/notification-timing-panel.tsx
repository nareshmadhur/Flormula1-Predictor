'use client'

import { useActionState } from 'react'
import { ChevronRight, Clock3 } from 'lucide-react'
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
  timingSummary: string
}

const initialState: NotificationTimingActionState = {}

export function TenantNotificationTimingPanel({
  groupName,
  currentLeadHoursLabel,
  defaultLeadHours,
  overrideLeadHours,
  timingSummary,
}: TenantNotificationTimingPanelProps) {
  const [saveState, saveAction] = useActionState(saveTenantNotificationTiming, initialState)
  const [clearState, clearAction] = useActionState(clearTenantNotificationTiming, initialState)
  const hasOverride = Boolean(overrideLeadHours)

  return (
    <details id="group-reminders" className="group scroll-mt-28 rounded-2xl border border-white/10 bg-card p-5 shadow-xl md:p-6">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <Clock3 className="h-4 w-4 text-red-400" />
              Reminders
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
              {hasOverride ? 'Custom timing' : 'Default timing'}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
            {currentLeadHoursLabel}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Reminder emails for {groupName} use this timing before prediction lock.
          </p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
      </summary>

      <div className="mt-5 space-y-5">
        <p className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm leading-6 text-slate-400">
          {timingSummary}
        </p>

        <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
          <form action={saveAction} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Hours before lock
              </span>
              <input
                name="race_reminder_lead_hours"
                type="number"
                min={1}
                max={240}
                defaultValue={overrideLeadHours || defaultLeadHours}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none transition-colors focus:border-red-500"
              />
            </label>
            <FormActionButton
              idleLabel={hasOverride ? 'Update timing' : 'Save timing'}
              pendingLabel="Saving..."
              className="sm:min-w-40"
            />
            {saveState.message && (
              <div className={`text-sm sm:col-span-2 ${saveState.status === 'success' ? 'text-emerald-200' : 'text-amber-200'}`}>
                {saveState.message}
              </div>
            )}
          </form>

          {hasOverride && (
            <form action={clearAction} className="mt-3">
              <FormActionButton idleLabel="Use default timing" pendingLabel="Clearing..." tone="secondary" />
              {clearState.message && (
                <div className={`mt-2 text-sm ${clearState.status === 'success' ? 'text-emerald-200' : 'text-amber-200'}`}>
                  {clearState.message}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </details>
  )
}
