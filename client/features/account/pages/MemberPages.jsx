import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { api } from '../../../shared/lib/api'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import { useAction } from '../../../shared/hooks/useAction'
import Pagination from '../../../shared/components/Pagination'
import { Button } from '../../../shared/components/primitives/button'
import {
  Empty,
  ErrorState,
  Loading,
  MutationFeedback,
  PageHeading,
  Status,
} from '../../../shared/components/ui'
import { BookCover } from '../../catalog/components/BookCover'
import LanguageSelector from '../../../shared/components/LanguageSelector'
import ThemeButton from '../../../shared/components/ThemeButton'
import { useAuth } from '../../auth/providers/AuthProvider'
import ReservationRow from '../components/ReservationRow'
import NotificationRow from '../components/NotificationRow'
import ProfilePage from './ProfilePage'

function useDate() {
  const { i18n } = useTranslation()
  return (value) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
          new Date(value),
        )
      : '—'
}
const loanStatus = (loan) =>
  loan.outcome === 'lost'
    ? 'lost'
    : loan.returnedAt
      ? 'returned'
      : new Date(loan.dueAt) < new Date()
        ? 'overdue'
        : 'on_loan'

function RenewButton({ loan }) {
  const { t } = useTranslation()
  const renew = useAction(`/loans/${loan._id}/renew`)
  return (
    <>
      <Button
        className="button secondary small"
        disabled={renew.isPending || new Date(loan.dueAt) < new Date()}
        onClick={() => renew.mutate(undefined)}
      >
        {t('member.renew')}
      </Button>
      <MutationFeedback error={renew.error} />
    </>
  )
}

// Loans table used by the dashboard, My Books and History.
function LoansTable({ loans, history = false }) {
  const { t } = useTranslation()
  const date = useDate()
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t('member.book')}</th>
            <th>{t('member.borrowedAt')}</th>
            <th>{t('member.due')}</th>
            {history && <th>{t('member.returnedOn')}</th>}
            <th>{t('member.status')}</th>
            <th>{t('member.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan._id}>
              <td className="table-title">{loan.book?.title ?? t('member.archived')}</td>
              <td>{date(loan.createdAt)}</td>
              <td>{date(loan.dueAt)}</td>
              {history && <td>{date(loan.returnedAt)}</td>}
              <td>
                <Status value={loanStatus(loan)} />
              </td>
              <td>
                <div className="button-row">
                  {loan.book?._id && (
                    <Link className="button secondary small" to={`/book/${loan.book._id}`}>
                      {t('member.viewBook')}
                    </Link>
                  )}
                  {!loan.returnedAt && <RenewButton loan={loan} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PagedSection({ list, empty, children }) {
  if (list.isPending) return <Loading />
  if (list.error) return <ErrorState error={list.error} retry={() => void list.refetch()} />
  return (
    <section className="panel">
      {list.data.length ? children : <Empty title={empty} />}
      <Pagination {...list} />
    </section>
  )
}

export function MemberDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const date = useDate()
  const summary = useQuery({ queryKey: ['account-summary'], queryFn: () => api('/me/summary') })
  const loans = usePagedList('loans-current', '/loans', 'scope=mine&status=active')
  const data = summary.data
  const tiles = [
    ['borrowed', data?.currentLoans],
    ['dueSoon', data?.dueSoon],
    ['overdue', data?.overdue],
    ['reservations', data?.reservations],
  ]
  return (
    <>
      <PageHeading
        eyebrow={t('member.eyebrow')}
        title={t('member.welcome', { name: user?.name.split(' ')[0] })}
        description={t('member.intro')}
      >
        <Link className="button" to="/catalog">
          {t('member.browse')} <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </PageHeading>
      {summary.error ? (
        <ErrorState error={summary.error} retry={() => void summary.refetch()} />
      ) : (
        <div className="metrics-grid">
          {tiles.map(([key, value]) => (
            <div className="metric" key={key}>
              <div>
                <span>{t(`member.${key}`)}</span>
              </div>
              <strong className={key === 'overdue' && value > 0 ? 'danger-text' : ''}>
                {value ?? '—'}
              </strong>
            </div>
          ))}
          <div className="metric">
            <div>
              <span>{t('member.membership')}</span>
            </div>
            <strong>
              <Status value={data?.membershipStatus ?? 'active'} />
            </strong>
            {data?.memberSince && (
              <small>
                {t('member.since')} {date(data.memberSince)}
              </small>
            )}
          </div>
        </div>
      )}
      <h2>{t('member.currentLoans')}</h2>
      <PagedSection list={loans} empty={t('member.noLoans')}>
        <LoansTable loans={loans.data} />
      </PagedSection>
    </>
  )
}

export function MyBooks() {
  const { t } = useTranslation()
  const loans = usePagedList('loans-current', '/loans', 'scope=mine&status=active')
  return (
    <>
      <PageHeading title={t('member.nav.myBooks')} description={t('member.myBooksIntro')} />
      <PagedSection list={loans} empty={t('member.noLoans')}>
        <LoansTable loans={loans.data} />
      </PagedSection>
    </>
  )
}

export function BorrowingHistory() {
  const { t } = useTranslation()
  const loans = usePagedList('loans-history', '/loans', 'scope=mine&status=all')
  return (
    <>
      <PageHeading title={t('member.nav.history')} description={t('member.historyIntro')} />
      <PagedSection list={loans} empty={t('member.noHistory')}>
        <LoansTable loans={loans.data} history />
      </PagedSection>
    </>
  )
}

export function MemberReservations() {
  const { t } = useTranslation()
  const holds = usePagedList('holds-mine', '/reservations', 'scope=mine')
  return (
    <>
      <PageHeading
        title={t('member.nav.reservations')}
        description={t('member.reservationsIntro')}
      />
      <PagedSection list={holds} empty={t('member.noReservations')}>
        {holds.data.map((hold) => (
          <ReservationRow key={hold._id} hold={hold} />
        ))}
      </PagedSection>
    </>
  )
}

export function MemberFines() {
  const { t } = useTranslation()
  const fines = useQuery({ queryKey: ['fines-mine'], queryFn: () => api('/fines') })
  if (fines.isPending) return <Loading />
  if (fines.error) return <ErrorState error={fines.error} />
  return (
    <>
      <PageHeading title={t('fines.mine')} />
      <section className="panel">
        {fines.data.length ? (
          fines.data.map((fine) => (
            <div className="account-row" key={fine._id}>
              <div>
                <h3>{fine.loan?.book?.title}</h3>
                <p className="muted">
                  {t('fines.daysLate')}: {fine.daysOverdue} · {t('fines.amount')}:{' '}
                  {fine.amount.toFixed(2)} · {t('fines.balance')}:{' '}
                  {(fine.status === 'waived' ? 0 : fine.amount - fine.paid).toFixed(2)}
                </p>
              </div>
              <Status value={fine.status} />
            </div>
          ))
        ) : (
          <Empty title={t('fines.none')} />
        )}
      </section>
    </>
  )
}

export function ReadingList() {
  const { t } = useTranslation()
  const saved = useQuery({ queryKey: ['saved'], queryFn: () => api('/me/saved') })
  if (saved.isPending) return <Loading />
  if (saved.error) return <ErrorState error={saved.error} />
  return (
    <>
      <PageHeading title={t('member.nav.readingList')} description={t('member.readingIntro')} />
      {saved.data.length ? (
        <div className="saved-grid">
          {saved.data.map((book) => (
            <Link key={book._id} to={`/book/${book._id}`}>
              <BookCover book={book} />
              <h3>{book.title}</h3>
              <p className="muted">{book.author}</p>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title={t('member.noSaved')}>
          <p className="muted">{t('member.noSavedHint')}</p>
        </Empty>
      )}
    </>
  )
}

export function MemberNotifications() {
  const { t } = useTranslation()
  const notices = useQuery({ queryKey: ['notifications'], queryFn: () => api('/notifications') })
  if (notices.isPending) return <Loading />
  if (notices.error) return <ErrorState error={notices.error} />
  return (
    <>
      <PageHeading title={t('member.nav.notifications')} />
      <section className="panel">
        {notices.data.overdue.length > 0 && (
          <p className="form-error" role="status">
            {t('member.overdueNotice', { count: notices.data.overdue.length })}
          </p>
        )}
        {notices.data.items.length ? (
          notices.data.items.map((item) => <NotificationRow key={item._id} item={item} />)
        ) : (
          <Empty title={t('member.caughtUp')} />
        )}
      </section>
    </>
  )
}

export function MemberProfile() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeading title={t('member.nav.profile')} />
      <ProfilePage />
    </>
  )
}

export function MemberSettings() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeading title={t('member.nav.settings')} description={t('member.settingsIntro')} />
      <section className="panel form-stack">
        <div>
          <h2>{t('language.label')}</h2>
          <LanguageSelector />
        </div>
        <div>
          <h2>{t('theme.label')}</h2>
          <ThemeButton />
        </div>
        <p className="muted">{t('member.settingsSaved')}</p>
      </section>
    </>
  )
}
