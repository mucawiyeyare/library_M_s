import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import Pagination from '../../../shared/components/Pagination'
import { formatDate } from '../../../shared/lib/date'
import { Empty, ErrorState, Loading, PageHeading } from '../../../shared/components/ui'
export default function AuditPage() {
  const { t } = useTranslation()
  const audit = usePagedList('audit', '/staff/audit', '')
  return (
    <>
      <PageHeading
        eyebrow={t('ui.audit.eyebrow')}
        title={t('nav.audit')}
        description={t('ui.audit.intro')}
      />
      <section className="panel">
        {audit.isPending ? (
          <Loading />
        ) : audit.error ? (
          <ErrorState error={audit.error} />
        ) : audit.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('ui.audit.action')}</th>
                  <th>{t('ui.audit.actor')}</th>
                  <th>{t('ui.audit.record')}</th>
                  <th>{t('reports.cols.date')}</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((entry) => (
                  <tr key={entry._id}>
                    <td>
                      <strong>{entry.action}</strong>
                    </td>
                    <td>
                      {entry.actor?.name}
                      <small>{entry.actor?.email}</small>
                    </td>
                    <td className="mono">{entry.entity}</td>
                    <td>{formatDate(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t('ui.audit.empty')} />
        )}
        <Pagination
          page={audit.page}
          pages={audit.pages}
          total={audit.total}
          setPage={audit.setPage}
        />
      </section>
    </>
  )
}
