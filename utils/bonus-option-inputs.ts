import { createClient } from '@/utils/supabase/server'

type BonusOptionInputClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>

type CircuitOptionRow = {
  id: string
  name: string
  country?: string | null
  emoji?: string | null
}

export type BonusOptionInsertRow = {
  bonus_question_id: string
  option_type: 'custom_text' | 'circuit'
  label: string
  circuit_id?: string
}

export function getCleanBonusOptionLabels(formData: FormData) {
  return Array.from(formData.getAll('options'))
    .map((value) => String(value).trim())
    .filter(Boolean)
}

export function getSelectedCircuitOptionIds(formData: FormData) {
  return Array.from(new Set(
    formData
      .getAll('venue_options')
      .map((value) => String(value).trim())
      .filter(Boolean)
  ))
}

export function getCircuitOptionLabel(circuit: CircuitOptionRow) {
  const suffix = circuit.country ? ` · ${circuit.country}` : ''
  return `${circuit.name}${circuit.emoji ? ` ${circuit.emoji}` : ''}${suffix}`
}

export async function buildBonusOptionInsertRows(
  supabase: BonusOptionInputClient,
  questionId: string,
  formData: FormData
): Promise<BonusOptionInsertRow[]> {
  const optionLabels = getCleanBonusOptionLabels(formData)
  const circuitIds = getSelectedCircuitOptionIds(formData)
  const customOptions: BonusOptionInsertRow[] = optionLabels.map((label) => ({
    bonus_question_id: questionId,
    option_type: 'custom_text',
    label,
  }))

  if (circuitIds.length === 0) return customOptions

  const { data: circuits, error } = await supabase
    .from('circuits')
    .select('id, name, country, emoji')
    .in('id', circuitIds)

  if (error) {
    throw new Error(error.message || 'Could not load venue options.')
  }

  const circuitById = new Map(
    ((circuits || []) as CircuitOptionRow[]).map((circuit) => [circuit.id, circuit])
  )

  if (circuitById.size !== circuitIds.length) {
    throw new Error('One or more venue options are invalid.')
  }

  const circuitOptions = circuitIds.map((circuitId) => {
    const circuit = circuitById.get(circuitId)

    if (!circuit) {
      throw new Error('One or more venue options are invalid.')
    }

    return {
      bonus_question_id: questionId,
      option_type: 'circuit' as const,
      circuit_id: circuit.id,
      label: getCircuitOptionLabel(circuit),
    }
  })

  return [...customOptions, ...circuitOptions]
}
