import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import Pagination from '../../../shared/components/Pagination'
import { useAction } from '../../../shared/hooks/useAction'
import { formatDate } from '../../../shared/lib/date'
import { holdStatus } from '../../../shared/lib/reservation'
import { Button } from '../../../shared/components/primitives/button'
import {
  Empty,
  ErrorState,
  Loading,
  MutationFeedback,
  PageHeading,
  Status,
} from '../../../shared/components/ui'
function ReservationTableRow({ hold }) {
  const { t } = useTranslation()
  const cancel = useAction(`/reservations/${hold._id}/cancel`)
  return (
    <tr>
      <td>
        <strong>{hold.book?.title}</strong>
      </td>
      <td>
        {hold.member?.name}
        <small>{hold.member?.email}</small>
      </td>
      <td>{formatDate(hold.createdAt)}</td>
      <td>
        <Status value={holdStatus(hold)} />
      </td>
      <td>
        {hold.status === 'waiting' && (
          <Button
            className="button secondary small"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(undefined)}
          >
            {t('ui.res.cancel')}
          </Button>
        )}
        <MutationFeedback error={cancel.error} />
      </td>
    </tr>
  )
}
export default function ReservationsPage() {
  const { t } = useTranslation()
  const holds = usePagedList('reservations', '/reservations', 'status=waiting')
  return (
    <>
      <PageHeading
        eyebrow={t('ui.res.eyebrow')}
        title={t('nav.reservations')}
        description={t('ui.res.intro')}
      />
      <section className="panel">
        {holds.isPending ? (
          <Loading />
        ) : holds.error ? (
          <ErrorState error={holds.error} />
        ) : holds.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('reports.cols.title')}</th>
                  <th>{t('ui.issue.member')}</th>
                  <th>{t('ui.res.requested')}</th>
                  <th>{t('member.status')}</th>
                  <th>{t('member.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {holds.data.map((hold) => (
                  <ReservationTableRow key={hold._id} hold={hold} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t('ui.res.empty')} />
        )}
        <Pagination
          page={holds.page}
          pages={holds.pages}
          total={holds.total}
          setPage={holds.setPage}
        />
      </section>
    </>
  )
}
