import { useTranslation } from 'react-i18next'
import { Button } from './primitives/button'
import { AlertCircle } from 'lucide-react'
export function ErrorState({ error, retry }) {
  const { t } = useTranslation()
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <p>{error.message}</p>
      {retry && (
        <Button className="button secondary" onClick={retry}>
          {t('ui.common.tryAgain')}
        </Button>
      )}
    </div>
  )
}
