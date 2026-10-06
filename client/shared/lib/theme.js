export const themes = ['light', 'dark', 'system']
const storageKey = 'biblioteca-theme'

export function storedTheme() {
  try {
    const saved = localStorage.getItem(storageKey)
    return themes.includes(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  try {
    localStorage.setItem(storageKey, theme)
  } catch {
    /* Theme still works when storage is unavailable. */
  }
}
