import { createClient } from '@/utils/supabase/server'

type BonusOptionInputClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>

type DriverOptionRow = {
  id: string
  code: string
  full_name: string
  emoji?: string | null
}

type ConstructorOptionRow = {
  id: string
  name: string
  short_code: string
  emoji?: string | null
}

type CircuitOptionRow = {
  id: string
  name: string
  country?: string | null
  emoji?: string | null
}

export type BonusOptionInsertRow = {
  bonus_question_id: string
  option_type: 'custom_text' | 'driver' | 'constructor' | 'circuit'
  label: string
  driver_id?: string
  constructor_id?: string
  circuit_id?: string
}

export function getCleanBonusOptionLabels(formData: FormData) {
  return Array.from(formData.getAll('options'))
    .map((value) => String(value).trim())
    .filter(Boolean)
}

export function getSelectedCircuitOptionIds(formData: FormData) {
  return getUniqueFormIds(formData, 'venue_options')
}

export function getSelectedDriverOptionIds(formData: FormData) {
  return getUniqueFormIds(formData, 'driver_options')
}

export function getSelectedConstructorOptionIds(formData: FormData) {
  return getUniqueFormIds(formData, 'constructor_options')
}

function getUniqueFormIds(formData: FormData, key: string) {
  return Array.from(new Set(
    formData
      .getAll(key)
      .map((value) => String(value).trim())
      .filter(Boolean)
  ))
}

export function getDriverOptionLabel(driver: DriverOptionRow) {
  const suffix = driver.emoji ? ` ${driver.emoji}` : ''
  return `${driver.code} · ${driver.full_name}${suffix}`
}

export function getConstructorOptionLabel(constructor: ConstructorOptionRow) {
  const suffix = constructor.emoji ? ` ${constructor.emoji}` : ''
  return `${constructor.short_code} · ${constructor.name}${suffix}`
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
  const driverIds = getSelectedDriverOptionIds(formData)
  const constructorIds = getSelectedConstructorOptionIds(formData)
  const circuitIds = getSelectedCircuitOptionIds(formData)
  const customOptions: BonusOptionInsertRow[] = optionLabels.map((label) => ({
    bonus_question_id: questionId,
    option_type: 'custom_text',
    label,
  }))

  const referenceOptions: BonusOptionInsertRow[] = []

  if (driverIds.length > 0) {
    const { data: drivers, error } = await supabase
      .from('drivers')
      .select('id, code, full_name, emoji')
      .in('id', driverIds)

    if (error) {
      throw new Error(error.message || 'Could not load driver options.')
    }

    const driverById = new Map(
      ((drivers || []) as DriverOptionRow[]).map((driver) => [driver.id, driver])
    )

    if (driverById.size !== driverIds.length) {
      throw new Error('One or more driver options are invalid.')
    }

    referenceOptions.push(
      ...driverIds.map((driverId) => {
        const driver = driverById.get(driverId)

        if (!driver) {
          throw new Error('One or more driver options are invalid.')
        }

        return {
          bonus_question_id: questionId,
          option_type: 'driver' as const,
          driver_id: driver.id,
          label: getDriverOptionLabel(driver),
        }
      })
    )
  }

  if (constructorIds.length > 0) {
    const { data: constructors, error } = await supabase
      .from('constructors')
      .select('id, name, short_code, emoji')
      .in('id', constructorIds)

    if (error) {
      throw new Error(error.message || 'Could not load constructor options.')
    }

    const constructorById = new Map(
      ((constructors || []) as ConstructorOptionRow[]).map((constructor) => [constructor.id, constructor])
    )

    if (constructorById.size !== constructorIds.length) {
      throw new Error('One or more constructor options are invalid.')
    }

    referenceOptions.push(
      ...constructorIds.map((constructorId) => {
        const constructor = constructorById.get(constructorId)

        if (!constructor) {
          throw new Error('One or more constructor options are invalid.')
        }

        return {
          bonus_question_id: questionId,
          option_type: 'constructor' as const,
          constructor_id: constructor.id,
          label: getConstructorOptionLabel(constructor),
        }
      })
    )
  }

  if (circuitIds.length > 0) {
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

    referenceOptions.push(
      ...circuitIds.map((circuitId) => {
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
    )
  }

  return [...customOptions, ...referenceOptions]
}
