'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRace } from '@/app/actions/admin'
import { Plus } from 'lucide-react'
import {
  ADMIN_TIME_LABEL,
  formatAmsterdamInputValue,
  parseAmsterdamInputToIso,
} from '@/utils/amsterdam-time'

interface Circuit {
  id: string
  name: string
  emoji?: string | null
}

interface CreateRaceFormProps {
  circuits: Circuit[]
}

export function CreateRaceForm({ circuits }: CreateRaceFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [schedulePreset, setSchedulePreset] = useState<'standard' | 'sprint' | 'custom'>('standard')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [formData, setFormData] = useState({
    race_name: '',
    round: '',
    season: new Date().getFullYear().toString(),
    circuit_id: '',
    race_start_at: '',
    fp1_at: '',
    fp2_at: '',
    fp3_at: '',
    quali_at: '',
    sprint_at: '',
    sprint_quali_at: ''
  })

  const applyPreset = () => {
    if (!formData.race_start_at) return

    const raceStartIso = parseAmsterdamInputToIso(formData.race_start_at)
    const raceStart = raceStartIso ? new Date(raceStartIso) : null
    if (!raceStart) return

    const dayBefore = new Date(raceStart.getTime() - 24 * 60 * 60 * 1000)
    const twoDaysBefore = new Date(raceStart.getTime() - 48 * 60 * 60 * 1000)

    const fillStandard = {
      fp1_at: formatAmsterdamInputValue(new Date(dayBefore.setHours(10, 0, 0, 0))),
      fp2_at: formatAmsterdamInputValue(new Date(dayBefore.setHours(13, 0, 0, 0))),
      fp3_at: formatAmsterdamInputValue(new Date(dayBefore.setHours(16, 0, 0, 0))),
      quali_at: formatAmsterdamInputValue(new Date(dayBefore.setHours(19, 0, 0, 0))),
      sprint_quali_at: '',
      sprint_at: ''
    }

    const fillSprint = {
      fp1_at: formatAmsterdamInputValue(new Date(dayBefore.setHours(10, 0, 0, 0))),
      fp2_at: formatAmsterdamInputValue(new Date(dayBefore.setHours(13, 0, 0, 0))),
      fp3_at: formatAmsterdamInputValue(new Date(dayBefore.setHours(16, 0, 0, 0))),
      quali_at: formatAmsterdamInputValue(new Date(dayBefore.setHours(19, 0, 0, 0))),
      sprint_quali_at: formatAmsterdamInputValue(new Date(twoDaysBefore.setHours(16, 0, 0, 0))),
      sprint_at: formatAmsterdamInputValue(new Date(dayBefore.setHours(17, 0, 0, 0)))
    }

    if (schedulePreset === 'standard') {
      setFormData(prev => ({ ...prev, ...fillStandard }))
    } else if (schedulePreset === 'sprint') {
      setFormData(prev => ({ ...prev, ...fillSprint }))
    }
  }

  const isFormValid = useMemo(() => {
    return !!formData.race_name && !!formData.round && !!formData.circuit_id && !!formData.race_start_at && !!formData.fp1_at
  }, [formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    if (!isFormValid) {
      setFeedback({
        type: 'error',
        message: 'Please fill race name, round, season, circuit, race date, and FP1 before creating the race.',
      })
      return
    }

    setIsLoading(true)
    setFeedback(null)
    try {
      const submitFormData = new FormData()
      Object.entries(formData).forEach(([key, value]) => {
        if (value) submitFormData.append(key, value)
      })

      await createRace(submitFormData)

      setFormData({
        race_name: '',
        round: '',
        season: new Date().getFullYear().toString(),
        circuit_id: '',
        race_start_at: '',
        fp1_at: '',
        fp2_at: '',
        fp3_at: '',
        quali_at: '',
        sprint_at: '',
        sprint_quali_at: ''
      })
      setFeedback({ type: 'success', message: 'Race created and added to the season calendar.' })
      router.refresh()
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'An error occurred while creating the race.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (name === 'race_start_at' && schedulePreset !== 'custom') {
      setTimeout(applyPreset, 10)
    }
  }

  return (
    <div className="bg-card border border-white/5 p-6 rounded-2xl shadow-xl">
      <h2 className="mb-4 flex items-center text-xl font-bold">
        <Plus className="w-5 h-5 mr-2" />
        Add race weekend
      </h2>

      <label className="mb-2 block text-sm font-medium">Weekend template</label>
      <select
        value={schedulePreset}
        onChange={e => setSchedulePreset(e.target.value as 'standard' | 'sprint' | 'custom')}
        className="mb-4 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        disabled={isLoading}
      >
        <option value="standard">Standard weekend</option>
        <option value="sprint">Sprint weekend</option>
        <option value="custom">Custom schedule</option>
      </select>

      {feedback && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300">
          Prediction lock is set automatically to FP1 minus 5 minutes.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Race Name</label>
            <input
              type="text"
              name="race_name"
              value={formData.race_name}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Round</label>
            <input
              type="number"
              name="round"
              value={formData.round}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Season</label>
            <input
              type="number"
              name="season"
              value={formData.season}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Circuit</label>
            <select
              name="circuit_id"
              value={formData.circuit_id}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
              disabled={isLoading}
            >
              <option value="">Select circuit</option>
              {circuits.map(circuit => (
                <option key={circuit.id} value={circuit.id}>
                  {circuit.emoji} {circuit.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Race date & time ({ADMIN_TIME_LABEL})</label>
          <input
            type="datetime-local"
            name="race_start_at"
            value={formData.race_start_at}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            required
            disabled={isLoading}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">FP1 ({ADMIN_TIME_LABEL}, required)</label>
            <input
              type="datetime-local"
              name="fp1_at"
              value={formData.fp1_at}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">FP2 ({ADMIN_TIME_LABEL}, optional)</label>
            <input
              type="datetime-local"
              name="fp2_at"
              value={formData.fp2_at}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">FP3 ({ADMIN_TIME_LABEL}, optional)</label>
            <input
              type="datetime-local"
              name="fp3_at"
              value={formData.fp3_at}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Qualifying ({ADMIN_TIME_LABEL}, optional)</label>
            <input
              type="datetime-local"
              name="quali_at"
              value={formData.quali_at}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Sprint ({ADMIN_TIME_LABEL}, optional)</label>
            <input
              type="datetime-local"
              name="sprint_at"
              value={formData.sprint_at}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Sprint qualifying ({ADMIN_TIME_LABEL}, optional)</label>
            <input
              type="datetime-local"
              name="sprint_quali_at"
              value={formData.sprint_quali_at}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isLoading}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-lg bg-red-500 px-4 py-3 font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-500/50"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Adding race...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add race
            </>
          )}
        </button>
      </form>

      <p className="mt-2 text-xs text-slate-400">Enter dates in {ADMIN_TIME_LABEL}. Required: race + FP1; others are optional.</p>
    </div>
  )
}
