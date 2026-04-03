const AMSTERDAM_TIME_ZONE = 'Europe/Amsterdam'

function getFormatterParts(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: AMSTERDAM_TIME_ZONE,
    ...options,
  }).formatToParts(date)
}

function getPartValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value || ''
}

function getAmsterdamOffsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AMSTERDAM_TIME_ZONE,
    timeZoneName: 'shortOffset',
  }).formatToParts(date)

  const offsetLabel = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT+0'
  const match = offsetLabel.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)

  if (!match) return 0

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2] || '0')
  const minutes = Number(match[3] || '0')

  return sign * (hours * 60 + minutes)
}

export function formatAmsterdamInputValue(value: string | Date | null | undefined) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = getFormatterParts(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const year = getPartValue(parts, 'year')
  const month = getPartValue(parts, 'month')
  const day = getPartValue(parts, 'day')
  const hour = getPartValue(parts, 'hour')
  const minute = getPartValue(parts, 'minute')

  return `${year}-${month}-${day}T${hour}:${minute}`
}

export function parseAmsterdamInputToIso(value: string | null | undefined) {
  if (!value) return null

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null

  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)

  let utcMillis = Date.UTC(year, month - 1, day, hour, minute)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const offsetMinutes = getAmsterdamOffsetMinutes(new Date(utcMillis))
    utcMillis = Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000
  }

  return new Date(utcMillis).toISOString()
}

export function formatAmsterdamDateTime(
  value: string | null | undefined,
  options?: {
    includeWeekday?: boolean
    includeZone?: boolean
  }
) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: AMSTERDAM_TIME_ZONE,
    weekday: options?.includeWeekday === false ? undefined : 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: options?.includeZone ? 'short' : undefined,
  }).format(date)
}

export const ADMIN_TIME_LABEL = 'CET / CEST'
