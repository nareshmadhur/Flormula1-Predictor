'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ClipboardCheck, Timer } from 'lucide-react'
import { saveBatchOfficialResults } from '@/app/actions/admin'
import {
  initialManualResultsActionState,
  type ManualResultsActionState,
} from '@/app/admin/results-action-state'
import { PendingLink } from '@/components/ui/pending-link'
import { FormActionButton } from '@/components/ui/form-action-button'
import { getAdminRaceStatusBadgeClasses, getAdminRaceStatusLabel } from '@/utils/admin-race-status'
import type { RaceStatus } from '@/utils/race-status'

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

type BatchResultRace = {
  id: string
  season: number
  round: number
  race_name: string
  effectiveStatus: RaceStatus
  hasExistingResult: boolean
  selectedByDefault: boolean
  existingResult: RaceResultRecord | null
}

type BatchResultsFormProps = {
  races: BatchResultRace[]
  drivers: DriverRecord[]
}

function getDefaultSelection(races: BatchResultRace[]) {
  return new Set(
    races
      .filter((race) => race.selectedByDefault)
      .map((race) => race.id)
  )
}

export function BatchResultsForm({ races, drivers }: BatchResultsFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ManualResultsActionState, FormData>(
    saveBatchOfficialResults,
    initialManualResultsActionState
  )
  const [selectedRaceIds, setSelectedRaceIds] = useState(() => getDefaultSelection(races))

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  useEffect(() => {
    setSelectedRaceIds(getDefaultSelection(races))
  }, [races])

  const selectedCount = selectedRaceIds.size
  const needsResultsCount = useMemo(
    () => races.filter((race) => !race.hasExistingResult).length,
    [races]
  )

  function toggleRace(raceId: string) {
    setSelectedRaceIds((current) => {
      const next = new Set(current)
      if (next.has(raceId)) {
        next.delete(raceId)
      } else {
        next.add(raceId)
      }
      return next
    })
  }

  function selectSuggested() {
    setSelectedRaceIds(getDefaultSelection(races))
  }

  function clearSelection() {
    setSelectedRaceIds(new Set())
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-red-100">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Multi-race save
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              Pick the weekends you want to update, save their podiums together, then run scoring from the race page
              when you are ready. Group bonus answers are managed by tenant admins.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={selectSuggested}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Select ready races
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 font-medium text-slate-200">
            {selectedCount} selected
          </div>
          <div className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 font-medium text-red-100">
            {needsResultsCount} waiting for results
          </div>
          <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 font-medium text-amber-100">
            Saving a scored weekend moves it back to needs scoring
          </div>
        </div>

        {state.status !== 'idle' && state.message && (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
              state.status === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/30 bg-red-500/10 text-red-200'
            }`}
          >
            {state.message}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {races.map((race) => {
          const selected = selectedRaceIds.has(race.id)

          return (
            <section
              key={race.id}
              className={`overflow-hidden rounded-3xl border shadow-xl transition-colors ${
                selected
                  ? 'border-red-500/25 bg-card'
                  : 'border-white/10 bg-card/80'
              }`}
            >
              <div className="border-b border-white/10 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <label className="flex min-w-0 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      name="selected_race_ids"
                      value={race.id}
                      checked={selected}
                      onChange={() => toggleRace(race.id)}
                      disabled={pending}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 text-red-500 focus:ring-red-500"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.22em]">
                        <span className="text-red-400">Round {race.round}</span>
                        <span className="text-slate-500">{race.season}</span>
                      </div>
                      <div className="mt-1 break-words text-xl font-black italic tracking-tight text-white">
                        {race.race_name}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${getAdminRaceStatusBadgeClasses(race.effectiveStatus)}`}
                        >
                          {getAdminRaceStatusLabel(race.effectiveStatus)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                          {race.hasExistingResult ? 'Result saved' : 'Awaiting result'}
                        </span>
                      </div>
                    </div>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-300">
                      {selected ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                          Included in save
                        </>
                      ) : (
                        <>
                          <Circle className="h-3.5 w-3.5 text-slate-500" />
                          Skipped
                        </>
                      )}
                    </span>
                    <PendingLink
                      href={`/admin/races/${race.id}`}
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                    >
                      Open race
                    </PendingLink>
                  </div>
                </div>
              </div>

              <fieldset
                disabled={!selected || pending}
                className={`grid gap-4 p-4 sm:p-5 ${
                  selected ? '' : 'opacity-55'
                }`}
              >
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
                    <Timer className="h-4 w-4 text-red-400" />
                    Podium
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([1, 2, 3] as const).map((position) => (
                      <div key={position}>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          P{position}
                        </label>
                        <select
                          name={`race:${race.id}:p${position}_driver_id`}
                          defaultValue={
                            race.existingResult?.[`p${position}_driver_id` as keyof RaceResultRecord] || ''
                          }
                          required={selected}
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white disabled:cursor-not-allowed disabled:text-slate-500"
                        >
                          <option value="" disabled className="bg-slate-900 text-white">
                            Select
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
              </fieldset>
            </section>
          )
        })}
      </div>

      <div className="sticky bottom-3 z-20 rounded-3xl border border-white/10 bg-slate-950/90 p-4 shadow-2xl backdrop-blur">
        <FormActionButton
          idleLabel={selectedCount > 0 ? `Save ${selectedCount} selected weekend${selectedCount === 1 ? '' : 's'}` : 'Select a weekend to save'}
          pendingLabel="Saving selected weekends..."
          tone="primary"
          disabled={selectedCount === 0}
        />
      </div>
    </form>
  )
}
