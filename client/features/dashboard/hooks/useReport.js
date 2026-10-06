import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'

// Runs one of the report-builder reports for a dashboard panel.
export function useReport(type, params = '') {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['report-run', type, params, i18n.language, 'dashboard'],
    queryFn: () => api(`/staff/reports/run/${type}?lang=${i18n.language}&all=true${params}`),
  })
}
