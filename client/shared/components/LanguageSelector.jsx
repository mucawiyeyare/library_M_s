import { useTranslation } from 'react-i18next'
import { languages, setLanguage } from '../../i18n'
import { useAuth } from '../../features/auth/providers/AuthProvider'
import { savePreferences } from '../lib/preferences'
const short = { en: 'EN', so: 'SO', ar: 'AR' }
// EN | SO | AR. The page, form data and session are untouched when the language changes.
export default function LanguageSelector() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  return (
    <div className="segmented" role="group" aria-label={t('language.label')}>
      {languages.map((lng) => (
        <button
          key={lng}
          type="button"
          lang={lng}
          aria-pressed={i18n.language === lng}
          aria-label={t(`language.${lng}`)}
          title={t(`language.${lng}`)}
          onClick={() => {
            void setLanguage(lng)
            if (user) void savePreferences({ lang: lng })
          }}
        >
          {short[lng]}
        </button>
      ))}
    </div>
  )
}
