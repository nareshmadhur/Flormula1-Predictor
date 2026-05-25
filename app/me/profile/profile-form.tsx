'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateOwnProfile } from '@/app/actions/profile'
import { initialProfileActionState } from './action-state'
import { RaceStartLights } from '@/components/ui/race-start-lights'

type ProfileFormProps = {
  defaultDisplayName: string
  email: string | null
  defaultRaceReminderEmailsEnabled: boolean
  defaultScoreRecapEmailsEnabled: boolean
}

export function ProfileForm({
  defaultDisplayName,
  email,
  defaultRaceReminderEmailsEnabled,
  defaultScoreRecapEmailsEnabled,
}: ProfileFormProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(defaultDisplayName)
  const [raceReminderEmailsEnabled, setRaceReminderEmailsEnabled] = useState(defaultRaceReminderEmailsEnabled)
  const [scoreRecapEmailsEnabled, setScoreRecapEmailsEnabled] = useState(defaultScoreRecapEmailsEnabled)
  const [state, formAction, pending] = useActionState(
    updateOwnProfile,
    initialProfileActionState
  )

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-2">
          <label htmlFor="display_name" className="text-sm font-medium text-slate-300">
            Display Name
          </label>
          <input
            id="display_name"
            name="display_name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={40}
            required
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all focus:border-red-500 focus:ring-1 focus:ring-red-500"
            placeholder="Your public display name"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-300">Account Email</div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">
            {email || 'No email found'}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Preview</div>
        <div className="mt-3 text-2xl font-black italic tracking-tight text-white">
          {displayName.trim() || defaultDisplayName}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Email preferences</div>
        <div className="mt-4 grid gap-3">
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <input
              type="checkbox"
              name="race_reminder_emails_enabled"
              checked={raceReminderEmailsEnabled}
              onChange={(event) => setRaceReminderEmailsEnabled(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-black/40 text-red-600 accent-red-600"
            />
            <span>
              <span className="block text-sm font-bold text-slate-100">Prediction reminders</span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                Send one reminder before lock only when you have not submitted for the next race.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <input
              type="checkbox"
              name="score_recap_emails_enabled"
              checked={scoreRecapEmailsEnabled}
              onChange={(event) => setScoreRecapEmailsEnabled(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-black/40 text-red-600 accent-red-600"
            />
            <span>
              <span className="block text-sm font-bold text-slate-100">Score recaps</span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                Send a recap when final points and leaderboard movement are published.
              </span>
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`race-submit-shell inline-flex items-center rounded-xl px-5 py-3 font-bold transition-colors ${
          pending
            ? 'cursor-not-allowed bg-slate-700 text-slate-300'
            : 'bg-red-600 text-white hover:bg-red-500'
        }`}
      >
        {pending && <RaceStartLights />}
        {pending ? 'Saving Settings...' : 'Save Profile Settings'}
      </button>

      {state.message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            state.status === 'success'
              ? 'border border-green-500/20 bg-green-500/10 text-green-300'
              : 'border border-red-500/20 bg-red-500/10 text-red-300'
          }`}
        >
          {state.message}
        </div>
      )}
    </form>
  )
}
