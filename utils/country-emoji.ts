const COUNTRY_EMOJI_MAP: Record<string, string> = {
  australia: '🇦🇺',
  austria: '🇦🇹',
  azerbaijan: '🇦🇿',
  bahrain: '🇧🇭',
  belgium: '🇧🇪',
  brazil: '🇧🇷',
  canada: '🇨🇦',
  china: '🇨🇳',
  italy: '🇮🇹',
  japan: '🇯🇵',
  mexico: '🇲🇽',
  monaco: '🇲🇨',
  netherlands: '🇳🇱',
  qatar: '🇶🇦',
  'saudi arabia': '🇸🇦',
  singapore: '🇸🇬',
  spain: '🇪🇸',
  'united arab emirates': '🇦🇪',
  'uae': '🇦🇪',
  'united kingdom': '🇬🇧',
  'great britain': '🇬🇧',
  britain: '🇬🇧',
  'united states': '🇺🇸',
  usa: '🇺🇸',
  us: '🇺🇸',
  hungary: '🇭🇺',
}

function normalizeCountry(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

export function getCountryEmoji(country: string | null | undefined) {
  const normalized = normalizeCountry(country)
  if (!normalized) return null
  return COUNTRY_EMOJI_MAP[normalized] || null
}
