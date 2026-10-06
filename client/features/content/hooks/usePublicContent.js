import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'

// Fetches published content of one kind in the active language (English fallback is server-side).
export function usePublicContent(kind, enabled = true) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['public-content', kind, i18n.language],
    queryFn: () => api(`/library/content/${kind}?lang=${i18n.language}`),
    enabled,
  })
}
