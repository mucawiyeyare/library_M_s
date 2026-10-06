import { useTranslation } from 'react-i18next'
import { Button } from './primitives/button'
export default function Pagination({ page, pages, total, setPage }) {
  const { t } = useTranslation()
  return (
    <nav className="list-pagination" aria-label={t('ui.common.pagination')}>
      <span className="muted">{t('ui.common.pageOf', { total, page, pages })}</span>
      <div className="button-row">
        <Button
          type="button"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          {t('catalog.previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          {t('catalog.next')}
        </Button>
      </div>
    </nav>
  )
}
