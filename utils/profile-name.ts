function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

export function getProfileDisplayName(
  displayName?: string | null,
  email?: string | null,
  fallback = 'Anonymous'
) {
  const normalizedDisplayName = displayName?.trim()
  if (normalizedDisplayName) return normalizedDisplayName

  const emailLocalPart = email?.split('@')[0]?.trim()
  if (emailLocalPart) {
    const normalizedEmailName = emailLocalPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (normalizedEmailName) {
      return toTitleCase(normalizedEmailName)
    }
  }

  return fallback
}
