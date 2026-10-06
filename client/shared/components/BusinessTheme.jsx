import { useEffect } from 'react'
import { useLibrarySettings } from '../hooks/useLibrarySettings'
import { brandPalette, defaultColors } from '../lib/brand-palette'
export default function BusinessTheme() {
  const { data } = useLibrarySettings()
  useEffect(() => {
    const css = document.createElement('style')
    css.dataset.businessTheme = 'true'
    const serialize = (dark) =>
      Object.entries(
        brandPalette(
          data?.primaryColor ?? defaultColors.primaryColor,
          data?.secondaryColor ?? defaultColors.secondaryColor,
          dark,
        ),
      )
        .map(([key, value]) => `${key}:${value}`)
        .join(';')
    css.textContent = `:root{${serialize(false)}}:root[data-theme="dark"]{${serialize(true)}}`
    document.head.append(css)
    return () => css.remove()
  }, [data?.primaryColor, data?.secondaryColor])
  return null
}
