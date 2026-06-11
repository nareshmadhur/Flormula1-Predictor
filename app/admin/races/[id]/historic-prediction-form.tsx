'use client'

import { useMemo, useState } from 'react'
import { FormActionButton } from '@/components/ui/form-action-button'
import { getProfileDisplayName } from '@/utils/profile-name'

type ProfileRecord = {
  id: string
  display_name?: string | null
  email?: string | null
  tenant_id?: string | null
}

type DriverRecord = {
  id: string
  code: string
  full_name: string
}

type BonusOption = {
  id: string
  label?: string | null
}

type BonusQuestion = {
  id: string
  tenant_id?: string | null
  question_text: string
  bonus_options?: BonusOption[]
}

type HistoricPredictionFormProps = {
  raceId: string
  action: (formData: FormData) => void | Promise<void>
  profiles: ProfileRecord[]
  drivers: DriverRecord[]
  bonusQuestions: BonusQuestion[]
}

function getProfileOptionLabel(profile: ProfileRecord) {
  const name = getProfileDisplayName(profile.display_name, profile.email)
  return profile.email ? `${name} · ${profile.email}` : name
}

export function HistoricPredictionForm({
  raceId,
  action,
  profiles,
  drivers,
  bonusQuestions,
}: HistoricPredictionFormProps) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const selectedProfile = profiles.find((profile) => profile.id === selectedUserId) || null
  const visibleBonusQuestions = useMemo(() => {
    if (!selectedProfile?.tenant_id) return []
    return bonusQuestions.filter((question) => question.tenant_id === selectedProfile.tenant_id)
  }, [bonusQuestions, selectedProfile])

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="race_id" value={raceId} />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-400">Select user</label>
        <select
          name="user_id"
          required
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2"
        >
          <option value="" disabled className="bg-slate-900 text-white">Choose user</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id} className="bg-slate-900 text-white">
              {getProfileOptionLabel(profile)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((position) => (
          <div key={position}>
            <label className="mb-1 block text-xs font-bold text-slate-500">P{position}</label>
            <select
              name={`p${position}`}
              required
              defaultValue=""
              className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm"
            >
              <option value="" disabled className="bg-slate-900 text-white">---</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id} className="bg-slate-900 text-white">
                  {driver.code} - {driver.full_name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <details className="rounded-xl border border-white/10 bg-black/20 p-4">
        <summary className="cursor-pointer list-none text-sm font-bold text-slate-200 [&::-webkit-details-marker]:hidden">
          Historic bonus answers
        </summary>
        {!selectedUserId ? (
          <p className="mt-3 text-sm text-slate-500">Select a user first to load their group bonus questions.</p>
        ) : visibleBonusQuestions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">This user has no group bonus questions for this race.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleBonusQuestions.map((question) => (
              <div key={question.id}>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {question.question_text}
                </label>
                <select
                  name={`historic_bonus_${question.id}`}
                  defaultValue=""
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2"
                >
                  <option value="" className="bg-slate-900 text-white">Leave unchanged</option>
                  {question.bonus_options?.map((option) => (
                    <option key={option.id} value={option.id} className="bg-slate-900 text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </details>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
        This backfills the podium pick and any selected historic bonus answers for the chosen user. Existing bonus answers stay unchanged when left blank.
      </div>

      <FormActionButton idleLabel="Submit prediction for user" pendingLabel="Saving prediction..." tone="secondary" className="mt-2" />
    </form>
  )
}
