import { useAction } from '../../../shared/hooks/useAction'
import { formatDate } from '../../../shared/lib/date'
import { Button } from '../../../shared/components/primitives/button'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../../../shared/components/primitives/input'
import { Modal, MutationFeedback, Status } from '../../../shared/components/ui'
export default function LoanTableRow({ loan }) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const [followUp, setFollowUp] = useState(false)
  const [condition, setCondition] = useState('good')
  const [notes, setNotes] = useState('')
  const [note, setNote] = useState('')
  const follow = useAction(`/loans/${loan._id}/follow-up`, 'POST', () => {
    setNote('')
    setFollowUp(false)
  })
  const renew = useAction(`/loans/${loan._id}/renew`)
  const returned = useAction(`/loans/${loan._id}/return`, 'POST', () => setConfirm(false))
  const overdue = !loan.returnedAt && new Date(loan.dueAt) < new Date()
  return (
    <tr>
      <td>
        <strong>{loan.book?.title}</strong>
        <small>{loan.copy?.barcode}</small>
      </td>
      <td>
        {loan.member?.name}
        <small>{loan.member?.email}</small>
      </td>
      <td>
        {formatDate(loan.dueAt)}
        {loan.daysOverdue > 0 && (
          <small className="danger-text">
            {t('circ.daysOverdue', { count: loan.daysOverdue })}
            {loan.projectedFine > 0 &&
              ` · ${t('circ.fineSoFar', { amount: loan.projectedFine.toFixed(2) })}`}
          </small>
        )}
      </td>
      <td>
        <Status
          value={
            loan.outcome === 'lost'
              ? 'lost'
              : loan.returnedAt
                ? 'returned'
                : overdue
                  ? 'overdue'
                  : 'on_loan'
          }
        />
      </td>
      <td>
        <div className="button-row">
          {!loan.returnedAt && (
            <>
              <Button
                className="button secondary small"
                disabled={renew.isPending || overdue}
                onClick={() => renew.mutate(undefined)}
              >
                {t('member.renew')}
              </Button>
              <Button className="button secondary small" onClick={() => setConfirm(true)}>
                {t('ui.circ.return')}
              </Button>
              {overdue && (
                <Button className="button secondary small" onClick={() => setFollowUp(true)}>
                  {t('circ.followUp')}
                </Button>
              )}
            </>
          )}
        </div>
        <MutationFeedback error={renew.error} success={renew.isSuccess} message="Renewed." />
        <Modal
          title={t('circ.returnTitle')}
          description={t('ui.circ.returnIntro')}
          open={confirm}
          onOpenChange={setConfirm}
        >
          <p className="return-summary">
            <strong>{loan.book?.title}</strong>
            <br />
            {t('ui.copies.barcode')}: {loan.copy?.barcode}
            <br />
            {t('ui.issue.member')}: {loan.member?.name}
          </p>
          <label>
            {t('circ.condition')}
            <select value={condition} onChange={(event) => setCondition(event.target.value)}>
              {['good', 'damaged', 'lost'].map((value) => (
                <option key={value} value={value}>
                  {t(`circ.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('circ.notes')}
            <Input
              value={notes}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <MutationFeedback error={returned.error} />
          <Button
            className="button"
            disabled={returned.isPending}
            onClick={() => returned.mutate({ condition, notes })}
          >
            {returned.isPending ? '…' : t('circ.confirm')}
          </Button>
        </Modal>
        <Modal
          title={t('circ.followUp')}
          description={`${loan.book?.title} · ${loan.member?.name}`}
          open={followUp}
          onOpenChange={setFollowUp}
        >
          {loan.followUps?.length > 0 && (
            <>
              <strong>{t('circ.followUps')}</strong>
              <ul>
                {loan.followUps.map((item, index) => (
                  <li key={index}>
                    {formatDate(item.at)}: {item.note}
                  </li>
                ))}
              </ul>
            </>
          )}
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault()
              follow.mutate({ note })
            }}
          >
            <Input
              required
              minLength={3}
              maxLength={500}
              value={note}
              placeholder={t('circ.followUpNote')}
              aria-label={t('circ.followUpNote')}
              onChange={(event) => setNote(event.target.value)}
            />
            <Button className="button" disabled={follow.isPending}>
              {t('circ.saveFollowUp')}
            </Button>
          </form>
        </Modal>
      </td>
    </tr>
  )
}
