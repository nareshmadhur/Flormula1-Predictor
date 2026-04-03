type DriverRecord = {
  code?: string | null
  emoji?: string | null
}

type PodiumPrediction = {
  id: string
  user_id: string
  race_id: string
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type PodiumResult = {
  race_id: string
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type RaceScore = {
  user_id: string
  race_id: string
  total_points: number
  podium_points: number
  bonus_points: number
  exact_hits: number
}

type BonusQuestion = {
  id: string
  race_id: string
  question_text: string
  display_order?: number | null
  bonus_options?: Array<{
    id: string
    label?: string | null
  }> | null
}

type PredictionBonusAnswer = {
  prediction_id: string
  bonus_question_id: string
  bonus_option_id: string
}

type RaceBonusAnswer = {
  race_id: string
  bonus_question_id: string
  correct_bonus_option_id: string
}

type ScoredRace = {
  id: string
  round: number
  race_name: string
  race_start_at: string
}

export type PodiumSlotOutcome = 'exact' | 'podium' | 'miss'

export type PodiumSlotBreakdown = {
  slot: 'P1' | 'P2' | 'P3'
  predictedLabel: string
  actualLabel: string
  outcome: PodiumSlotOutcome
  actualPositionLabel?: 'P1' | 'P2' | 'P3'
}

export type BonusBreakdownItem = {
  label: string
  selectedLabel: string
  correctLabel: string
  isCorrect: boolean
}

export type UserRaceLeaderboardBreakdown = {
  raceId: string
  round: number
  raceName: string
  raceStartAt: string
  totalPoints: number
  podiumPoints: number
  bonusPoints: number
  exactHits: number
  podiumHits: number
  actualPodiumLabels: string[]
  bonusCorrectCount: number
  bonusTotalCount: number
  bonusItems: BonusBreakdownItem[]
  slots: PodiumSlotBreakdown[]
}

function getDriverLabel(driverId: string | null | undefined, driversById: Map<string, DriverRecord>) {
  if (!driverId) return 'No pick'

  const driver = driversById.get(driverId)
  if (!driver?.code) return 'UNK'

  return driver.emoji ? `${driver.code} ${driver.emoji}` : driver.code
}

function getPodiumPositions(prediction: PodiumPrediction | PodiumResult) {
  return [prediction.p1_driver_id, prediction.p2_driver_id, prediction.p3_driver_id]
}

function shortenQuestionLabel(questionText: string) {
  const normalized = questionText.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 20) return normalized

  const words = normalized.split(' ')
  if (words.length > 1) {
    const compact = words.slice(0, 3).join(' ')
    if (compact.length <= 20) return compact
  }

  return `${normalized.slice(0, 17).trim()}...`
}

export function buildUserLeaderboardBreakdowns({
  races,
  predictions,
  raceResults,
  raceScores,
  bonusQuestions,
  predictionBonusAnswers,
  raceBonusAnswers,
  driversById,
}: {
  races: ScoredRace[]
  predictions: PodiumPrediction[]
  raceResults: PodiumResult[]
  raceScores: RaceScore[]
  bonusQuestions: BonusQuestion[]
  predictionBonusAnswers: PredictionBonusAnswer[]
  raceBonusAnswers: RaceBonusAnswer[]
  driversById: Map<string, DriverRecord>
}) {
  const raceById = new Map(races.map((race) => [race.id, race]))
  const resultByRaceId = new Map(raceResults.map((result) => [result.race_id, result]))
  const scoreByUserRace = new Map(
    raceScores.map((score) => [`${score.user_id}:${score.race_id}`, score])
  )

  const questionsByRaceId = new Map<string, BonusQuestion[]>()
  const optionLabelById = new Map<string, string>()

  bonusQuestions.forEach((question) => {
    const current = questionsByRaceId.get(question.race_id) || []
    current.push(question)
    questionsByRaceId.set(question.race_id, current)

    question.bonus_options?.forEach((option) => {
      optionLabelById.set(option.id, option.label?.trim() || 'Unknown option')
    })
  })

  questionsByRaceId.forEach((questions, raceId) => {
    questionsByRaceId.set(
      raceId,
      [...questions].sort((left, right) => (left.display_order || 0) - (right.display_order || 0))
    )
  })

  const bonusAnswerByPredictionQuestion = new Map(
    predictionBonusAnswers.map((answer) => [`${answer.prediction_id}:${answer.bonus_question_id}`, answer.bonus_option_id])
  )
  const correctBonusByRaceQuestion = new Map(
    raceBonusAnswers.map((answer) => [`${answer.race_id}:${answer.bonus_question_id}`, answer.correct_bonus_option_id])
  )

  const breakdowns = new Map<string, UserRaceLeaderboardBreakdown[]>()

  predictions.forEach((prediction) => {
    const race = raceById.get(prediction.race_id)
    const result = resultByRaceId.get(prediction.race_id)
    const score = scoreByUserRace.get(`${prediction.user_id}:${prediction.race_id}`)

    if (!race || !result) return

    const predictedPositions = getPodiumPositions(prediction)
    const actualPositions = getPodiumPositions(result)
    const exactHits = predictedPositions.filter((driverId, index) => driverId === actualPositions[index]).length
    const podiumHits = predictedPositions.filter((driverId) => actualPositions.includes(driverId)).length

    const slots: PodiumSlotBreakdown[] = (['P1', 'P2', 'P3'] as const).map((slot, index) => {
      const predictedDriverId = predictedPositions[index]
      const actualDriverId = actualPositions[index]
      const actualPositionIndex = actualPositions.indexOf(predictedDriverId)
      const outcome: PodiumSlotOutcome =
        predictedDriverId === actualDriverId
          ? 'exact'
          : actualPositions.includes(predictedDriverId)
            ? 'podium'
            : 'miss'

      return {
        slot,
        predictedLabel: getDriverLabel(predictedDriverId, driversById),
        actualLabel: getDriverLabel(actualDriverId, driversById),
        actualPositionLabel:
          actualPositionIndex >= 0 ? (['P1', 'P2', 'P3'][actualPositionIndex] as 'P1' | 'P2' | 'P3') : undefined,
        outcome,
      }
    })

    const raceQuestions = questionsByRaceId.get(prediction.race_id) || []
    const bonusItems: BonusBreakdownItem[] = raceQuestions.map((question) => {
      const selectedOptionId = bonusAnswerByPredictionQuestion.get(`${prediction.id}:${question.id}`)
      const correctOptionId = correctBonusByRaceQuestion.get(`${prediction.race_id}:${question.id}`)
      const selectedLabel = selectedOptionId
        ? optionLabelById.get(selectedOptionId) || 'Unknown option'
        : 'No pick'
      const correctLabel = correctOptionId
        ? optionLabelById.get(correctOptionId) || 'Unknown option'
        : 'Awaiting answer'

      return {
        label: shortenQuestionLabel(question.question_text),
        selectedLabel,
        correctLabel,
        isCorrect: Boolean(selectedOptionId && correctOptionId && selectedOptionId === correctOptionId),
      }
    })

    const current = breakdowns.get(prediction.user_id) || []
    current.push({
      raceId: race.id,
      round: race.round,
      raceName: race.race_name,
      raceStartAt: race.race_start_at,
      totalPoints: score?.total_points || 0,
      podiumPoints: score?.podium_points || 0,
      bonusPoints: score?.bonus_points || 0,
      exactHits,
      podiumHits,
      actualPodiumLabels: actualPositions.map((driverId, index) => `P${index + 1} ${getDriverLabel(driverId, driversById)}`),
      bonusCorrectCount: bonusItems.filter((item) => item.isCorrect).length,
      bonusTotalCount: bonusItems.length,
      bonusItems,
      slots,
    })
    breakdowns.set(prediction.user_id, current)
  })

  breakdowns.forEach((entries, userId) => {
    breakdowns.set(
      userId,
      [...entries].sort(
        (left, right) => new Date(left.raceStartAt).getTime() - new Date(right.raceStartAt).getTime()
      )
    )
  })

  return breakdowns
}
