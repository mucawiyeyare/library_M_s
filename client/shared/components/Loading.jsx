import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
export function Loading() {
  const { t } = useTranslation()
  return (
    <div className="state" role="status">
      <Loader2 className="spin" size={24} /> {t('ui.common.loading')}
    </div>
  )
}
