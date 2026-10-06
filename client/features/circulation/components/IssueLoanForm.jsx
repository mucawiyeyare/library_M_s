import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'
import { useAction } from '../../../shared/hooks/useAction'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { ErrorState, MutationFeedback } from '../../../shared/components/ui'

// A calendar date (YYYY-MM-DD) in the library's time zone (East Africa Time, UTC+3).
const localDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000 + 3 * 3600000).toISOString().slice(0, 10)

// Borrow a book: pick the member and the book (search or choose), the borrow time is set by
// the system, and the return date is picked on a calendar (it starts at the loan policy).
export default function IssueLoanForm({ onIssued }) {
  const { t, i18n } = useTranslation()
  const [memberSearch, setMemberSearch] = useState('')
  const [memberId, setMemberId] = useState('')
  const [bookSearch, setBookSearch] = useState('')
  const [bookId, setBookId] = useState('')
  const [copyId, setCopyId] = useState('')
  const [returnDate, setReturnDate] = useState('')

  const members = useQuery({
    queryKey: ['borrow-members', memberSearch],
    queryFn: () =>
      api(`/staff/members?status=active&page=1&limit=25&q=${encodeURIComponent(memberSearch)}`),
  })
  const books = useQuery({
    queryKey: ['borrow-books', bookSearch],
    queryFn: () => api(`/books?available=true&limit=25&q=${encodeURIComponent(bookSearch)}`),
  })
  const copies = useQuery({
    queryKey: ['borrow-copies', bookId],
    queryFn: () => api(`/staff/copies?book=${bookId}&status=available&page=1&limit=50`),
    enabled: !!bookId,
  })
  const policy = useQuery({ queryKey: ['public-policies'], queryFn: () => api('/library/policies') })
  const issue = useAction('/loans', 'POST', onIssued)

  const memberList = (members.data?.items ?? []).filter((member) => member.status === 'active')
  const bookList = books.data?.items ?? []
  const copyList = copies.data?.items ?? []

  // A search that matches exactly one member or book selects it straight away.
  useEffect(() => {
    if (memberList.length === 1) setMemberId(memberList[0]._id)
  }, [memberList])
  useEffect(() => {
    if (bookList.length === 1) setBookId(bookList[0]._id)
  }, [bookList])
  // The first available copy of the chosen book is suggested; staff can pick another.
  useEffect(() => {
    if (copyList.length && !copyList.some((copy) => copy._id === copyId)) setCopyId(copyList[0]._id)
  }, [copyList, copyId])
  // The return date starts at the library's loan period.
  useEffect(() => {
    if (!returnDate && policy.data) setReturnDate(localDate(policy.data.loanDays))
  }, [policy.data, returnDate])

  if (members.error || books.error) return <ErrorState error={members.error || books.error} />
  const now = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault()
        issue.mutate({ memberId, copyId, returnDate })
      }}
    >
      <fieldset>
        <legend>{t('ui.issue.member')}</legend>
        <Input
          aria-label={t('ui.issue.searchMembers')}
          placeholder={t('ui.issue.searchMembersHint')}
          value={memberSearch}
          onChange={(event) => {
            setMemberSearch(event.target.value)
            setMemberId('')
          }}
        />
        <select
          aria-label={t('ui.issue.member')}
          required
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
        >
          <option value="">{t('ui.issue.selectMember')}</option>
          {memberList.map((member) => (
            <option key={member._id} value={member._id}>
              {member.name} ({member.email})
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend>{t('member.book')}</legend>
        <Input
          aria-label={t('ui.issue.searchBooks')}
          placeholder={t('ui.issue.searchBooksHint')}
          value={bookSearch}
          onChange={(event) => {
            setBookSearch(event.target.value)
            setBookId('')
            setCopyId('')
          }}
        />
        <select
          aria-label={t('member.book')}
          required
          value={bookId}
          onChange={(event) => {
            setBookId(event.target.value)
            setCopyId('')
          }}
        >
          <option value="">{t('ui.issue.selectBook')}</option>
          {bookList.map((book) => (
            <option key={book._id} value={book._id}>
              {book.title} · {book.author} ({t('catalog.available', { count: book.copies.available })})
            </option>
          ))}
        </select>
        {bookId && (
          <label>
            {t('ui.issue.copy')}
            <select required value={copyId} onChange={(event) => setCopyId(event.target.value)}>
              {copyList.map((copy) => (
                <option key={copy._id} value={copy._id}>
                  {copy.barcode} · {copy.shelf}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>

      <div className="form-grid">
        <label>
          {t('ui.issue.borrowTime')}
          <Input value={now} readOnly aria-readonly="true" />
          <small className="muted">{t('ui.issue.borrowTimeHint')}</small>
        </label>
        <label>
          {t('ui.issue.returnDate')}
          <Input
            type="date"
            required
            min={localDate(1)}
            max={localDate(365)}
            value={returnDate}
            onChange={(event) => setReturnDate(event.target.value)}
          />
          <small className="muted">
            {t('ui.issue.returnDateHint', { days: policy.data?.loanDays ?? '…' })}
          </small>
        </label>
      </div>
      <p className="muted">{t('ui.issue.checks')}</p>
      <MutationFeedback error={issue.error} />
      <Button className="button" disabled={issue.isPending || !memberId || !copyId}>
        {issue.isPending ? t('ui.issue.issuing') : t('ui.issue.issue')}
      </Button>
    </form>
  )
}
