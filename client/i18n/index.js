import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/common.json'
import so from './locales/so/common.json'
import ar from './locales/ar/common.json'

export const languages = ['en', 'so', 'ar']
export const rtlLanguages = ['ar']
const storageKey = 'biblioteca-lang'

function storedLanguage() {
  try {
    const saved = localStorage.getItem(storageKey)
    return languages.includes(saved) ? saved : 'en'
  } catch {
    return 'en'
  }
}

// Keeps <html lang dir> in step with the active language (one app, LTR <-> RTL).
export function applyDirection(lng) {
  document.documentElement.lang = lng
  document.documentElement.dir = rtlLanguages.includes(lng) ? 'rtl' : 'ltr'
}

export function setLanguage(lng) {
  if (!languages.includes(lng)) return
  try {
    localStorage.setItem(storageKey, lng)
  } catch {
    /* The language still changes for this session. */
  }
  return i18n.changeLanguage(lng)
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, so: { translation: so }, ar: { translation: ar } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  supportedLngs: languages,
  interpolation: { escapeValue: false },
  // A key missing even in English renders nothing, never the raw key.
  parseMissingKeyHandler: () => '',
})
applyDirection(i18n.language)
i18n.on('languageChanged', applyDirection)
export default i18n
