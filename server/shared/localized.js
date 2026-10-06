export const LANGUAGES = ['en', 'so', 'ar']

// Picks the requested language, then English, then any available translation.
export function pick(field, lang) {
  if (!field) return ''
  return (
    field[lang]?.trim() ||
    field.en?.trim() ||
    LANGUAGES.map((l) => field[l]?.trim()).find(Boolean) ||
    ''
  )
}

// Languages that have no text yet, so staff can see what still needs translating.
export function missingLanguages(...fields) {
  return LANGUAGES.filter((lang) => fields.some((field) => field && !field[lang]?.trim()))
}
