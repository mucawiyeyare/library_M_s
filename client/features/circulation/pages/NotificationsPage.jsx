import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import Pagination from '../../../shared/components/Pagination'
import { Empty, ErrorState, Loading, PageHeading } from '../../../shared/components/ui'
import LoanTableRow from '../components/LoanTableRow'

function LoanSection({ title, intro, list, empty }) {
  const { t } = useTranslation()
  return (
    <section className="panel">
      <div className="section-heading compact">
        <div>
          <h2>
            {title} <span className="nav-badge inline-badge">{list.total}</span>
          </h2>
          <p className="muted">{intro}</p>
        </div>
      </div>
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <ErrorState error={list.error} retry={() => void list.refetch()} />
      ) : list.data.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('ui.circ.bookCopy')}</th>
                <th>{t('ui.issue.member')}</th>
                <th>{t('member.due')}</th>
                <th>{t('member.status')}</th>
                <th>{t('member.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((loan) => (
                <LoanTableRow key={loan._id} loan={loan} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={empty} />
      )}
      <Pagination {...list} />
    </section>
  )
}

// Staff notifications: borrows whose time is finished (overdue) and those due back today.
export default function NotificationsPage() {
  const { t } = useTranslation()
  const overdue = usePagedList('loans', '/loans', 'status=overdue')
  const today = usePagedList('loans', '/loans', 'status=due-today')
  return (
    <>
      <PageHeading
        eyebrow={t('ui.alerts.eyebrow')}
        title={t('nav.notifications')}
        description={t('ui.alerts.intro')}
      />
      <LoanSection
        title={t('ui.alerts.finished')}
        intro={t('ui.alerts.finishedIntro')}
        list={overdue}
        empty={t('ui.alerts.noneFinished')}
      />
      <LoanSection
        title={t('ui.alerts.today')}
        intro={t('ui.alerts.todayIntro')}
        list={today}
        empty={t('ui.alerts.noneToday')}
      />
    </>
  )
}
