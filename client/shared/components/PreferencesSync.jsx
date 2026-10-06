import { useEffect } from 'react'
import { setLanguage } from '../../i18n'
import { applyTheme } from '../lib/theme'
import { useAuth } from '../../features/auth/providers/AuthProvider'
// When a user signs in (or the session restores), their saved language and theme win.
export default function PreferencesSync() {
  const { user } = useAuth()
  const id = user?._id
  const lang = user?.lang
  const theme = user?.theme
  useEffect(() => {
    if (!id) return
    if (lang) void setLanguage(lang)
    if (theme) {
      applyTheme(theme)
      window.dispatchEvent(new Event('biblioteca-preferences'))
    }
  }, [id, lang, theme])
  return null
}
