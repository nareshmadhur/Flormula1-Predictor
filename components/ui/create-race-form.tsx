'use client'

import { useMemo, useState } from 'react'
import { createRace } from '@/app/actions/admin'
import { Plus } from 'lucide-react'

interface Circuit {
  id: string
  name: string
  emoji: string
}

interface CreateRaceFormProps {
  circuits: Circuit[]
}

const CET_DST_MONTHS = [4, 5, 6, 7, 8, 9, 10]

function formatISODateForInput(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const mi = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function parseCETDateTime(value: string) {
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return null

  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)

  const isDST = CET_DST_MONTHS.includes(month)
  const offsetHours = isDST ? 2 : 1

  const utc = Date.UTC(year, month - 1, day, hours - offsetHours, minutes)
  return new Date(utc)
}

export function CreateRaceForm({ circuits }: CreateRaceFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [schedulePreset, setSchedulePreset] = useState<'standard' | 'sprint' | 'custom'>('standard')
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

    const raceStart = parseCETDateTime(formData.race_start_at)
    if (!raceStart) return

    const dayBefore = new Date(raceStart.getTime() - 24 * 60 * 60 * 1000)
    const twoDaysBefore = new Date(raceStart.getTime() - 48 * 60 * 60 * 1000)

    const fillStandard = {
      fp1_at: formatISODateForInput(new Date(dayBefore.setHours(10, 0, 0, 0))),
      fp2_at: formatISODateForInput(new Date(dayBefore.setHours(13, 0, 0, 0))),
      fp3_at: formatISODateForInput(new Date(dayBefore.setHours(16, 0, 0, 0))),
      quali_at: formatISODateForInput(new Date(dayBefore.setHours(19, 0, 0, 0))),
      sprint_quali_at: '',
      sprint_at: ''
    }

    const fillSprint = {
      fp1_at: formatISODateForInput(new Date(dayBefore.setHours(10, 0, 0, 0))),
      fp2_at: formatISODateForInput(new Date(dayBefore.setHours(13, 0, 0, 0))),
      fp3_at: formatISODateForInput(new Date(dayBefore.setHours(16, 0, 0, 0))),
      quali_at: formatISODateForInput(new Date(dayBefore.setHours(19, 0, 0, 0))),
      sprint_quali_at: formatISODateForInput(new Date(twoDaysBefore.setHours(16, 0, 0, 0))),
      sprint_at: formatISODateForInput(new Date(dayBefore.setHours(17, 0, 0, 0)))
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
      alert('Please fill required fields: Race name, Round, Season, Circuit, Race date, and FP1.')
      return
    }

    setIsLoading(true)
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
      window.location.reload()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred while creating the race')
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
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <Plus className="w-5 h-5 mr-2" />
        Create Race
      </h2>

      <label className="block text-sm font-medium mb-2">Schedule preset</label>
      <select
        value={schedulePreset}
        onChange={e => setSchedulePreset(e.target.value as 'standard' | 'sprint' | 'custom')}
        className="mb-4 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        disabled={isLoading}
      >
        <option value="standard">Standard schedule (default)</option>
        <option value="sprint">Sprint weekend (preset)</option>
        <option value="custom">Custom (manual entry)</option>
      </select>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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
              <option value="">Select Circuit</option>
              {circuits.map(circuit => (
                <option key={circuit.id} value={circuit.id}>
                  {circuit.emoji} {circuit.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Race Date & Time (CET)</label>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">FP1 (required)</label>
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
            <label className="block text-sm font-medium mb-1">FP2 (optional)</label>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">FP3 (optional)</label>
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
            <label className="block text-sm font-medium mb-1">Quali (optional)</label>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Sprint (optional)</label>
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
            <label className="block text-sm font-medium mb-1">Sprint Quali (optional)</label>
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
          className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creating Race...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create Race
            </>
          )}
        </button>
      </form>

      <p className="mt-2 text-xs text-slate-400">Enter dates in CET. Required: race + FP1; others are optional.</p>
    </div>
  )
}
