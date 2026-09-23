export type BonusAnswerType = 'choice' | 'numeric'

export type BonusAnswerValue = {
  optionId?: string | null
  numericValue?: string | number | null
}

export type BonusQuestionAnswerShape = {
  answer_type?: BonusAnswerType | null
  bonus_options?: Array<{ id: string; label?: string | null }> | null
}

const NUMERIC_VALUE_PATTERN = /^\d+(?:\.\d+)?$/

/**
 * Return a stable decimal representation for values stored in PostgreSQL numeric.
 * Counts and other non-negative numeric answers deliberately reject signs and
 * exponent notation so the client and database enforce the same input shape.
 */
export function normalizeNumericBonusValue(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
  }

  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw || raw.length > 100 || !NUMERIC_VALUE_PATTERN.test(raw)) return null

  const [wholePart, fractionPart = ''] = raw.split('.')
  const whole = wholePart.replace(/^0+(?=\d)/, '') || '0'
  const fraction = fractionPart.replace(/0+$/, '')

  return fraction ? `${whole}.${fraction}` : whole
}

export function isNumericBonusAnswer(value: unknown): value is string | number {
  return normalizeNumericBonusValue(value) !== null
}

export function hasBonusAnswerValue(answerType: BonusAnswerType, answer: BonusAnswerValue) {
  if (answerType === 'numeric') {
    return normalizeNumericBonusValue(answer.numericValue) !== null
  }

  return Boolean(answer.optionId)
}

export function bonusAnswerValuesMatch(
  answerType: BonusAnswerType,
  left: BonusAnswerValue,
  right: BonusAnswerValue
) {
  if (answerType === 'numeric') {
    const leftValue = normalizeNumericBonusValue(left.numericValue)
    const rightValue = normalizeNumericBonusValue(right.numericValue)
    return leftValue !== null && leftValue === rightValue
  }

  return Boolean(left.optionId && right.optionId && left.optionId === right.optionId)
}

export function getBonusAnswerDisplay(
  question: BonusQuestionAnswerShape,
  answer: BonusAnswerValue,
  fallback = 'No answer'
) {
  if ((question.answer_type || 'choice') === 'numeric') {
    return normalizeNumericBonusValue(answer.numericValue) || fallback
  }

  if (!answer.optionId) return fallback
  return question.bonus_options?.find((option) => option.id === answer.optionId)?.label || 'Unknown option'
}
