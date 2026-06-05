'use client'

import { useMemo } from 'react'
import { FormActionButton } from '@/components/ui/form-action-button'

type DriverRecord = {
  id: string
  code: string
  full_name: string
}

type RaceResultRecord = {
  p1_driver_id?: string | null
  p2_driver_id?: string | null
  p3_driver_id?: string | null
}

type SuggestedEntry = {
  code: string
  fullName: string
  localDriverId: string | null
} | null

type SuggestedPodium = {
  source: string
  p1: SuggestedEntry
  p2: SuggestedEntry
  p3: SuggestedEntry
}

type OfficialResultsFormProps = {
  raceId: string
  action: (formData: FormData) => void | Promise<void>
  drivers: DriverRecord[]
  existingResult: RaceResultRecord | null
  suggestedPodium: SuggestedPodium | null
}

function getSuggestedLabel(entry: SuggestedEntry) {
  if (!entry) return null
  return `${entry.code} · ${entry.fullName}`
}

export function OfficialResultsForm({
  raceId,
  action,
  drivers,
  existingResult,
  suggestedPodium,
}: OfficialResultsFormProps) {
  const suggestedDefaults = useMemo(
    () => ({
      p1: existingResult?.p1_driver_id || suggestedPodium?.p1?.localDriverId || '',
      p2: existingResult?.p2_driver_id || suggestedPodium?.p2?.localDriverId || '',
      p3: existingResult?.p3_driver_id || suggestedPodium?.p3?.localDriverId || '',
    }),
    [existingResult, suggestedPodium]
  )

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="race_id" value={raceId} />

      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
        Save the official podium here. Tenant admins manage group bonus answers separately.
      </div>

      {suggestedPodium && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
          <div className="font-semibold">Suggested podium from {suggestedPodium.source}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestedPodium.p1 && (
              <span className="rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1">
                P1 · {getSuggestedLabel(suggestedPodium.p1)}
              </span>
            )}
            {suggestedPodium.p2 && (
              <span className="rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1">
                P2 · {getSuggestedLabel(suggestedPodium.p2)}
              </span>
            )}
            {suggestedPodium.p3 && (
              <span className="rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1">
                P3 · {getSuggestedLabel(suggestedPodium.p3)}
              </span>
            )}
          </div>
          <div className="mt-2 text-emerald-200/80">Prefilled where the app found a driver match. Review before saving.</div>
        </div>
      )}

      <div className="grid gap-4">
        <div className="space-y-4 rounded-xl border border-white/5 bg-black/30 p-4">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-300">Podium</h3>
            <p className="mt-1 text-xs text-slate-500">Review the finishing top three before publishing.</p>
          </div>
          {[1, 2, 3].map((position) => (
            <div key={position}>
              <label className="mb-1 block text-xs font-bold text-slate-500">P{position}</label>
              <select
                name={`p${position}_driver_id`}
                defaultValue={suggestedDefaults[`p${position}` as keyof typeof suggestedDefaults]}
                required
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2"
              >
                <option value="" disabled className="bg-slate-900 text-white">
                  Select Driver
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
      </div>

      <FormActionButton
        idleLabel="Save official results"
        pendingLabel="Saving official results..."
        tone="primary"
      />
    </form>
  )
}
