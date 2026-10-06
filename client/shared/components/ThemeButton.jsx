import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { applyTheme, storedTheme } from '../lib/theme'
import { useAuth } from '../../features/auth/providers/AuthProvider'
import { savePreferences } from '../lib/preferences'
const icons = { light: Sun, dark: Moon, system: Monitor }
// Light / Dark / System selector. Signed-in users also save the choice to their account.
export default function ThemeButton() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [theme, setTheme] = useState(storedTheme)
  useEffect(() => {
    applyTheme(theme)
    window.dispatchEvent(new Event('biblioteca-preferences'))
    if (theme !== 'system') return
    const query = matchMedia('(prefers-color-scheme: dark)')
    const follow = () => applyTheme('system')
    query.addEventListener('change', follow)
    return () => query.removeEventListener('change', follow)
  }, [theme])
  useEffect(() => {
    const sync = () => setTheme(storedTheme())
    window.addEventListener('biblioteca-preferences', sync)
    return () => window.removeEventListener('biblioteca-preferences', sync)
  }, [])
  return (
    <div className="segmented" role="group" aria-label={t('theme.label')}>
      {Object.entries(icons).map(([value, Icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          aria-label={t(`theme.${value}`)}
          title={t(`theme.${value}`)}
          onClick={() => {
            setTheme(value)
            if (user) void savePreferences({ theme: value })
          }}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
