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

type ExistingPrediction = {
  user_id: string
  p1_driver_id?: string | null
  p2_driver_id?: string | null
  p3_driver_id?: string | null
  bonus_answers?: Record<string, string>
}

type HistoricPredictionFormProps = {
  raceId: string
  action: (formData: FormData) => void | Promise<void>
  profiles: ProfileRecord[]
  drivers: DriverRecord[]
  bonusQuestions: BonusQuestion[]
  existingPredictions: ExistingPrediction[]
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
  existingPredictions,
}: HistoricPredictionFormProps) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const predictionByUserId = useMemo(
    () => new Map(existingPredictions.map((prediction) => [prediction.user_id, prediction])),
    [existingPredictions]
  )
  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers]
  )
  const selectedProfile = profiles.find((profile) => profile.id === selectedUserId) || null
  const selectedPrediction = predictionByUserId.get(selectedUserId) || null
  const visibleBonusQuestions = useMemo(() => {
    if (!selectedProfile?.tenant_id) return []
    return bonusQuestions.filter((question) => question.tenant_id === selectedProfile.tenant_id)
  }, [bonusQuestions, selectedProfile])

  function getCurrentPodiumDriverId(position: 1 | 2 | 3) {
    if (!selectedPrediction) return null
    if (position === 1) return selectedPrediction.p1_driver_id || null
    if (position === 2) return selectedPrediction.p2_driver_id || null
    return selectedPrediction.p3_driver_id || null
  }

  function getDriverLabel(driverId?: string | null) {
    if (!driverId) return 'No saved pick'
    const driver = driverById.get(driverId)
    return driver ? `${driver.code} - ${driver.full_name}` : 'Unknown driver'
  }

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

      {selectedUserId ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          {selectedPrediction ? (
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Current saved entry
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  { label: 'P1', driverId: selectedPrediction.p1_driver_id },
                  { label: 'P2', driverId: selectedPrediction.p2_driver_id },
                  { label: 'P3', driverId: selectedPrediction.p3_driver_id },
                ].map((pick) => (
                  <div key={pick.label} className="rounded-lg border border-white/5 bg-black/25 px-3 py-2">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {pick.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">
                      {getDriverLabel(pick.driverId)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-sm text-slate-400">
                {Object.keys(selectedPrediction.bonus_answers || {}).length} historic bonus answer
                {Object.keys(selectedPrediction.bonus_answers || {}).length === 1 ? '' : 's'} saved.
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">
              No saved prediction exists for this user on this race yet. Pick a full podium below if you want to create one.
            </div>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((position) => (
          <div key={position}>
            <label className="mb-1 block text-xs font-bold text-slate-500">P{position}</label>
            <select
              key={`${selectedUserId || 'empty'}-p${position}`}
              name={`p${position}`}
              defaultValue=""
              className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm"
            >
              <option value="" className="bg-slate-900 text-white">
                {getCurrentPodiumDriverId(position as 1 | 2 | 3)
                  ? `Keep current - ${getDriverLabel(getCurrentPodiumDriverId(position as 1 | 2 | 3))}`
                  : 'Choose driver'}
              </option>
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
                  key={`${selectedUserId || 'empty'}-${question.id}`}
                  name={`historic_bonus_${question.id}`}
                  defaultValue=""
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2"
                >
                  <option value="" className="bg-slate-900 text-white">
                    {selectedPrediction?.bonus_answers?.[question.id]
                      ? `Keep current - ${
                          question.bonus_options?.find(
                            (option) => option.id === selectedPrediction.bonus_answers?.[question.id]
                          )?.label || 'Saved answer'
                        }`
                      : 'Leave unchanged'}
                  </option>
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
        Leave any podium or bonus field on its current setting to keep it as-is. This lets you change only one answer without rewriting the rest of the entry.
      </div>

      <FormActionButton idleLabel="Save historic changes" pendingLabel="Saving changes..." tone="secondary" className="mt-2" />
    </form>
  )
}
