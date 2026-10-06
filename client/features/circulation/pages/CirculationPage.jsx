import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import Pagination from '../../../shared/components/Pagination'
import { Button } from '../../../shared/components/primitives/button'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Empty, ErrorState, Loading, Modal, PageHeading } from '../../../shared/components/ui'
import IssueLoanForm from '../components/IssueLoanForm'
import LoanTableRow from '../components/LoanTableRow'
export default function CirculationPage() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('active')
  const loans = usePagedList('loans', '/loans', `status=${filter}`)
  const filtered = loans.data
  return (
    <>
      <PageHeading
        eyebrow={t('ui.circ.eyebrow')}
        title={t('ui.circ.title')}
        description={t('ui.circ.intro')}
      >
        <Button className="button" onClick={() => setOpen(true)}>
          <Plus size={18} />
          {t('ui.issue.issue')}
        </Button>
      </PageHeading>
      <section className="panel">
        <div className="table-toolbar">
          <nav className="tabs inline" aria-label={t('ui.circ.filters')}>
            {['active', 'overdue', 'all'].map((item) => (
              <button
                className={item === filter ? 'active' : ''}
                key={item}
                onClick={() => setFilter(item)}
              >
                {t(`ui.circ.tab.${item}`)}
              </button>
            ))}
          </nav>
          <span className="muted">{t('ui.circ.count', { count: loans.total })}</span>
        </div>
        {loans.isPending ? (
          <Loading />
        ) : loans.error ? (
          <ErrorState error={loans.error} />
        ) : filtered.length ? (
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
                {filtered.map((loan) => (
                  <LoanTableRow key={loan._id} loan={loan} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t('ui.circ.empty')} />
        )}
        <Pagination
          page={loans.page}
          pages={loans.pages}
          total={loans.total}
          setPage={loans.setPage}
        />
      </section>
      <Modal
        title={t('ui.circ.issueTitle')}
        description={t('ui.circ.issueIntro')}
        open={open}
        onOpenChange={setOpen}
      >
        {open && <IssueLoanForm onIssued={() => setOpen(false)} />}
      </Modal>
    </>
  )
}
