import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import { useAction } from '../../../shared/hooks/useAction'
import { api } from '../../../shared/lib/api'
import Pagination from '../../../shared/components/Pagination'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { useAuth } from '../../auth/providers/AuthProvider'
import { Empty, ErrorState, Loading, PageHeading, Status } from '../../../shared/components/ui'

const statuses = ['outstanding', 'partially_paid', 'paid', 'waived']
const money = (value) => (Math.round(value * 100) / 100).toFixed(2)

// Inline payment / waiver controls for one fine.
function FineActions({ fine }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [mode, setMode] = useState(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const done = () => {
    setMode(null)
    setAmount('')
    setNote('')
  }
  const pay = useAction(`/fines/${fine._id}/payment`, 'POST', done)
  const waive = useAction(`/fines/${fine._id}/waive`, 'POST', done)
  const owed = fine.amount - fine.paid
  // Directors can see fines but only librarians and administrators change them.
  if (user?.role === 'director' || ['paid', 'waived'].includes(fine.status)) return null
  if (!mode)
    return (
      <div className="button-row">
        <Button
          size="sm"
          onClick={() => {
            setAmount(money(owed))
            setMode('payment')
          }}
        >
          {t('fines.recordPayment')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode('waiver')}>
          {t('fines.waive')}
        </Button>
      </div>
    )
  const paying = mode === 'payment'
  return (
    <form
      className="button-row"
      onSubmit={(event) => {
        event.preventDefault()
        if (paying) pay.mutate({ amount: Number(amount), note })
        else waive.mutate({ note })
      }}
    >
      {paying && (
        <Input
          type="number"
          step="0.01"
          min="0.01"
          max={owed}
          required
          value={amount}
          aria-label={t('fines.amount')}
          onChange={(event) => setAmount(event.target.value)}
        />
      )}
      <Input
        required={!paying}
        minLength={paying ? undefined : 3}
        maxLength={300}
        value={note}
        placeholder={t(paying ? 'fines.note' : 'fines.waiverReason')}
        aria-label={t(paying ? 'fines.note' : 'fines.waiverReason')}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button size="sm" disabled={pay.isPending || waive.isPending}>
        {t(paying ? 'fines.recordPayment' : 'fines.waive')}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={done}>
        {t('staffContent.cancel')}
      </Button>
    </form>
  )
}

export default function FinesPage() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState('outstanding')
  const summary = useQuery({ queryKey: ['fines-summary'], queryFn: () => api('/fines/summary') })
  const list = usePagedList('fines', '/fines', `status=${status}`)
  const date = (value) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value))
  return (
    <>
      <PageHeading title={t('fines.title')} description={t('fines.intro')} />
      <div className="metrics-grid">
        {[
          ['outstanding', summary.data?.outstanding],
          ['collected', summary.data?.collected],
          ['waived', summary.data?.waived],
        ].map(([key, value]) => (
          <div className="metric" key={key}>
            <div>
              <span>{t(`fines.${key}`)}</span>
            </div>
            <strong>{value === undefined ? '—' : money(value)}</strong>
          </div>
        ))}
      </div>
      <div className="segmented content-tabs" role="group" aria-label={t('fines.status')}>
        {statuses.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {t(`status.${value}`)}
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
                  <th>{t('fines.member')}</th>
                  <th>{t('fines.book')}</th>
                  <th>{t('fines.daysLate')}</th>
                  <th>{t('fines.amount')}</th>
                  <th>{t('fines.paid')}</th>
                  <th>{t('fines.date')}</th>
                  <th>{t('fines.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.map((fine) => (
                  <tr key={fine._id}>
                    <td className="table-title">{fine.member?.name}</td>
                    <td>{fine.loan?.book?.title}</td>
                    <td>{fine.daysOverdue}</td>
                    <td>{money(fine.amount)}</td>
                    <td>{money(fine.paid)}</td>
                    <td>{date(fine.createdAt)}</td>
                    <td>
                      <Status value={fine.status} />
                    </td>
                    <td>
                      <FineActions fine={fine} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t('fines.empty')} />
        )}
        <Pagination {...list} />
      </section>
    </>
  )
}
