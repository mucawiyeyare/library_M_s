import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import { useAction } from '../../../shared/hooks/useAction'
import Pagination from '../../../shared/components/Pagination'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { Empty, ErrorState, Loading, PageHeading } from '../../../shared/components/ui'

const statuses = ['pending', 'approved', 'rejected']

// Inline review controls: approve (asking for an email when the applicant gave none) or reject.
function ReviewActions({ item }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(null)
  const [value, setValue] = useState('')
  const done = () => setMode(null)
  const approve = useAction(`/staff/applications/${item._id}/approve`, 'POST', done)
  const reject = useAction(`/staff/applications/${item._id}/reject`, 'POST', done)
  if (item.status !== 'pending') return null
  if (!mode)
    return (
      <div className="button-row">
        <Button
          size="sm"
          onClick={() => (item.email ? approve.mutate({}) : setMode('approve'))}
          disabled={approve.isPending}
        >
          {t('staffApplications.approve')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode('reject')}>
          {t('staffApplications.reject')}
        </Button>
      </div>
    )
  const approving = mode === 'approve'
  return (
    <form
      className="button-row"
      onSubmit={(event) => {
        event.preventDefault()
        if (approving) approve.mutate({ email: value })
        else reject.mutate({ reason: value })
      }}
    >
      <Input
        type={approving ? 'email' : 'text'}
        required={approving}
        value={value}
        maxLength={approving ? 254 : 500}
        placeholder={t(approving ? 'staffApplications.loginEmail' : 'staffApplications.reason')}
        aria-label={t(approving ? 'staffApplications.loginEmail' : 'staffApplications.reason')}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button size="sm" disabled={approve.isPending || reject.isPending}>
        {t(approving ? 'staffApplications.approve' : 'staffApplications.reject')}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={done}>
        {t('staffContent.cancel')}
      </Button>
    </form>
  )
}

export default function ApplicationsPage() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState('pending')
  const list = usePagedList('applications', '/staff/applications', `status=${status}`)
  return (
    <>
      <PageHeading
        title={t('staffApplications.title')}
        description={t('staffApplications.intro')}
      />
      <div
        className="segmented content-tabs"
        role="group"
        aria-label={t('staffApplications.status')}
      >
        {statuses.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {t(`staffApplications.${value}`)}
          </button>
        ))}
      </div>
      <section className="panel">
        {list.isPending ? (
          <Loading />
        ) : list.error ? (
          <ErrorState error={list.error} retry={() => void list.refetch()} />
        ) : list.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('staffApplications.name')}</th>
                  <th>{t('staffApplications.phone')}</th>
                  <th>{t('staffApplications.email')}</th>
                  <th>{t('staffApplications.submitted')}</th>
                  <th>{t('staffApplications.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.map((item) => (
                  <tr key={item._id}>
                    <td className="table-title">{item.fullName}</td>
                    <td>{item.phone}</td>
                    <td>{item.email || '—'}</td>
                    <td>
                      {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
                        new Date(item.createdAt),
                      )}
                    </td>
                    <td>{t(`staffApplications.${item.status}`)}</td>
                    <td>
                      <ReviewActions item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t('staffApplications.empty')} />
        )}
        <Pagination {...list} />
      </section>
    </>
  )
}
