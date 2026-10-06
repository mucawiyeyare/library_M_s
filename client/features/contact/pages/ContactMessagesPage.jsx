import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import Pagination from '../../../shared/components/Pagination'
import { useState } from 'react'
import { useAction } from '../../../shared/hooks/useAction'
import { Button } from '../../../shared/components/primitives/button'
import { Loading, ErrorState, Empty, MutationFeedback } from '../../../shared/components/ui'
function MessageCard({ item }) {
  const { t, i18n } = useTranslation()
  const [reply, setReply] = useState('')
  const replyAction = useAction(`/staff/contact/${item._id}/reply`, 'POST', () => setReply(''))
  const action = useAction(`/staff/contact/${item._id}`, 'PATCH')
  return (
    <article className="panel contact-message">
      <div className="section-heading">
        <h2>{item.subject}</h2>
        <span className="muted">
          {item.status === 'new' ? t('ui.inbox.new') : t('ui.inbox.handled')}
        </span>
      </div>
      <p>
        <strong>{item.name}</strong> ·{' '}
        <a className="text-link" href={`mailto:${item.email}`}>
          {item.email}
        </a>
      </p>
      <small className="muted">{new Date(item.createdAt).toLocaleString(i18n.language)}</small>
      <p className="contact-message-body">{item.message}</p>
      <Button
        variant="outline"
        disabled={action.isPending}
        onClick={() => action.mutate({ status: item.status === 'new' ? 'handled' : 'new' })}
      >
        {item.status === 'new' ? t('ui.inbox.markHandled') : t('ui.inbox.reopen')}
      </Button>
      <details className="contact-reply">
        <summary>{t('ui.inbox.replyByEmail')}</summary>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            replyAction.mutate({ message: reply })
          }}
        >
          <label>
            {t('ui.inbox.reply')}
            <textarea
              rows={4}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              minLength={10}
              maxLength={3000}
              placeholder={t('ui.inbox.replyPlaceholder')}
              required
            />
          </label>
          <Button disabled={replyAction.isPending}>{t('ui.inbox.send')}</Button>
        </form>
      </details>
      <MutationFeedback error={action.error} />
    </article>
  )
}
export default function ContactMessagesPage() {
  const { t } = useTranslation()
  const messages = usePagedList('contact-messages', '/staff/contact')
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('ui.inbox.eyebrow')}</p>
          <h1>{t('nav.contact')}</h1>
          <p className="muted">{t('ui.inbox.intro')}</p>
        </div>
      </div>
      {messages.isPending ? (
        <Loading />
      ) : messages.error ? (
        <ErrorState error={messages.error} />
      ) : messages.data.length ? (
        <div className="contact-message-list">
          {messages.data.map((item) => (
            <MessageCard key={item._id} item={item} />
          ))}
        </div>
      ) : (
        <Empty title={t('ui.inbox.empty')} />
      )}
      <Pagination {...messages} />
    </>
  )
}
