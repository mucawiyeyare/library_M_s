import { useTranslation } from 'react-i18next'
import { useAction } from '../../../shared/hooks/useAction'
import { Button } from '../../../shared/components/primitives/button'
import { MutationFeedback } from '../../../shared/components/ui'

// Notices carry a key and values, shown in the reader's language; older notices
// without a key show their stored English message.
export default function NotificationRow({ item }) {
  const { t, i18n } = useTranslation()
  const markRead = useAction(`/notifications/${item._id}`, 'PATCH')
  const text = item.key
    ? t(`notice.${item.key}`, { ...item.params, defaultValue: item.message }).replace(/\s+\./g, '.')
    : item.message
  return (
    <div className="account-row">
      <div>
        <p>{text}</p>
        <small className="muted">
          {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
            new Date(item.createdAt),
          )}
        </small>
        <MutationFeedback error={markRead.error} />
      </div>
      {!item.read && (
        <Button
          className="button secondary"
          disabled={markRead.isPending}
          onClick={() => markRead.mutate(undefined)}
        >
          {t('notice.markRead')}
        </Button>
      )}
    </div>
  )
}
