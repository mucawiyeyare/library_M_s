import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import Pagination from '../../../shared/components/Pagination'
import { useAction } from '../../../shared/hooks/useAction'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { useState } from 'react'
import { Empty, ErrorState, Loading, MutationFeedback, Status } from '../../../shared/components/ui'
function CopyRow({ copy }) {
  const { t } = useTranslation()
  const [shelf, setShelf] = useState(copy.shelf)
  const action = useAction(`/staff/copies/${copy._id}`, 'PATCH')
  return (
    <div className="copy-row">
      <div>
        <strong>{copy.barcode}</strong>
        <Status value={copy.status} />
      </div>
      <label>
        {t('ui.copies.shelf')}
        <Input
          aria-label={t('ui.copies.shelfFor', { barcode: copy.barcode })}
          placeholder="e.g. FIC A-01"
          value={shelf}
          onChange={(event) => setShelf(event.target.value)}
        />
      </label>
      <div className="button-row">
        <Button
          className="button secondary"
          disabled={action.isPending || copy.status === 'on_loan'}
          onClick={() => action.mutate({ shelf, status: copy.status })}
        >
          {t('ui.copies.saveShelf')}
        </Button>
        <Button
          className="button secondary"
          disabled={action.isPending || copy.status === 'on_loan'}
          onClick={() =>
            action.mutate({ shelf, status: copy.status === 'retired' ? 'available' : 'retired' })
          }
        >
          {copy.status === 'retired' ? t('ui.copies.restore') : t('ui.copies.retire')}
        </Button>
      </div>
      <MutationFeedback error={action.error} success={action.isSuccess} />
    </div>
  )
}
export default function CopyManager({ book }) {
  const { t } = useTranslation()
  const [barcode, setBarcode] = useState('')
  const [shelf, setShelf] = useState('')
  const copies = usePagedList('copies', '/staff/copies', `book=${book._id}`)
  const add = useAction(`/staff/books/${book._id}/copies`, 'POST', () => setBarcode(''))
  return (
    <>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault()
          add.mutate({ barcode, shelf })
        }}
      >
        <div className="form-grid">
          <label>
            {t('ui.copies.barcode')}
            <Input
              required
              maxLength={80}
              placeholder="e.g. BIB-0001"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </label>
          <label>
            {t('ui.copies.shelf')}
            <Input
              required
              maxLength={80}
              placeholder="e.g. FIC A-01"
              value={shelf}
              onChange={(event) => setShelf(event.target.value)}
            />
          </label>
        </div>
        <Button className="button" disabled={add.isPending || book.archived}>
          {t('ui.copies.add')}
        </Button>
        <MutationFeedback
          error={add.error}
          success={add.isSuccess}
          message="Copy added to inventory."
        />
      </form>
      <h3 className="subheading">{t('ui.copies.title')}</h3>
      {copies.isPending ? (
        <Loading />
      ) : copies.error ? (
        <ErrorState error={copies.error} />
      ) : copies.data.length ? (
        copies.data.map((copy) => <CopyRow key={copy._id} copy={copy} />)
      ) : (
        <Empty title={t('ui.copies.empty')} />
      )}
      <Pagination {...copies} />
    </>
  )
}
