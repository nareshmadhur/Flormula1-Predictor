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
    <section className="rounded-2xl border border-white/10 bg-card p-5 shadow-xl md:p-6">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              <Clock3 className="h-4 w-4 text-red-400" />
              Reminder timing
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {currentLeadHoursLabel}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Reminder emails for {groupName} use this timing before prediction lock.
            </p>
          </div>

          <div className="w-fit rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
            {hasOverride ? 'Custom timing' : 'Default timing'}
          </div>
        </div>

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
    </section>
  )
}
