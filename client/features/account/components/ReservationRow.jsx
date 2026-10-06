import { useAction } from '../../../shared/hooks/useAction'
import { formatDate } from '../../../shared/lib/date'
import { useTranslation } from 'react-i18next'
import { holdStatus } from '../../../shared/lib/reservation'
import { Button } from '../../../shared/components/primitives/button'
import { MutationFeedback, Status } from '../../../shared/components/ui'
export default function ReservationRow({ hold }) {
  const { t } = useTranslation()
  const cancel = useAction(`/reservations/${hold._id}/cancel`)
  return (
    <div className="account-row">
      <div>
        <h3>{hold.book?.title ?? t('member.archived')}</h3>
        <p className="muted">{t('ui.common.requested', { date: formatDate(hold.createdAt) })}</p>
        {hold.ready && hold.status === 'waiting' && (
          <p>
            <strong>{t('circ.ready')}</strong>
            {hold.expiresAt && ` · ${t('circ.expires', { date: formatDate(hold.expiresAt) })}`}
          </p>
        )}
        <MutationFeedback error={cancel.error} />
      </div>
      <Status value={holdStatus(hold)} />
      {hold.status === 'waiting' && (
        <Button
          className="button secondary"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate(undefined)}
        >
          {t('staffContent.cancel')}
        </Button>
      )}
    </div>
  )
}
