'use client'

import { useActionState } from 'react'
import { Clock3 } from 'lucide-react'
import {
  savePlatformNotificationTiming,
  type NotificationTimingActionState,
} from '@/app/actions/admin-notifications'
import { FormActionButton } from '@/components/ui/form-action-button'

type PlatformTimingSettingsProps = {
  currentLeadHours: number
  fallbackHours: number
  source: 'platform' | 'fallback'
}

const initialState: NotificationTimingActionState = {}

export function PlatformTimingSettings({
  currentLeadHours,
  fallbackHours,
  source,
}: PlatformTimingSettingsProps) {
  const [state, formAction] = useActionState(savePlatformNotificationTiming, initialState)

  return (
    <section className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.38fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            <Clock3 className="h-4 w-4 text-red-400" />
            Reminder timing
          </div>
          <h2 className="mt-2 text-xl font-black italic tracking-tight text-white">Platform default</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Prediction reminders use {currentLeadHours} hours before lock unless a group has its own override.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
              Current {currentLeadHours}h
            </span>
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
              {source === 'platform' ? 'Platform setting' : `Fallback ${fallbackHours}h`}
            </span>
          </div>
        </div>

        <form action={formAction} className="rounded-2xl border border-white/5 bg-black/25 p-4">
          <label>
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Hours before lock
            </span>
            <input
              name="race_reminder_lead_hours"
              type="number"
              min={1}
              max={240}
              defaultValue={currentLeadHours}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-red-500"
            />
          </label>
          <FormActionButton idleLabel="Save default" pendingLabel="Saving..." className="mt-3" />
          {state.message && (
            <div className={`mt-3 text-sm ${state.status === 'success' ? 'text-emerald-200' : 'text-amber-200'}`}>
              {state.message}
            </div>
          )}
        </form>
      </div>
    </section>
  )
}
