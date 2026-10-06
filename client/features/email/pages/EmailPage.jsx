import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../shared/lib/api'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import { useAction } from '../../../shared/hooks/useAction'
import Pagination from '../../../shared/components/Pagination'
import { Button } from '../../../shared/components/primitives/button'
import { Loading, ErrorState, PageHeading, Empty } from '../../../shared/components/ui'
import EmailConfiguration from '../components/EmailConfiguration'
function EmailRow({ mail }) {
  const { t, i18n } = useTranslation()
  const retry = useAction(`/staff/email/${mail._id}/retry`)
  return (
    <article className="panel email-entry">
      <div className="section-heading">
        <div>
          <h2>{mail.subject}</h2>
          <p className="muted">
            {mail.to} | {mail.status} | {new Date(mail.createdAt).toLocaleString(i18n.language)}
          </p>
        </div>
        {['failed', 'preview'].includes(mail.status) && (
          <Button variant="outline" disabled={retry.isPending} onClick={() => retry.mutate()}>
            {t('ui.email.retry')}
          </Button>
        )}
      </div>
      {mail.lastError && <p className="danger-text">{mail.lastError}</p>}
      {mail.text && (
        <details>
          <summary>{t('ui.email.preview')}</summary>
          <pre className="email-preview">{mail.text}</pre>
        </details>
      )}
    </article>
  )
}
export default function EmailPage() {
  const { t } = useTranslation()
  const emails = usePagedList('email-outbox', '/staff/email')
  const status = useQuery({
    queryKey: ['email-status'],
    queryFn: () => api('/staff/email/status'),
  })
  return (
    <>
      <PageHeading
        eyebrow={t('ui.email.eyebrow')}
        title={t('nav.email')}
        description={t('ui.email.intro')}
      />
      <div className="panel email-configuration">
        <strong>
          {status.data?.configured
            ? t('ui.email.configured', { sender: status.data.sender })
            : status.data?.transport === 'preview'
              ? t('ui.email.previewMode')
              : t('ui.email.missing')}
        </strong>
        <p className="muted">{t('ui.email.note')}</p>
        {status.data && (
          <EmailConfiguration
            key={`${status.data.transport}-${status.data.sender}-${status.data.passwordConfigured}`}
            transport={status.data.transport}
            sender={status.data.sender}
            passwordConfigured={status.data.passwordConfigured}
          />
        )}
      </div>
      {emails.isPending ? (
        <Loading />
      ) : emails.error ? (
        <ErrorState error={emails.error} />
      ) : emails.data.length ? (
        <div className="email-list">
          {emails.data.map((mail) => (
            <EmailRow key={mail._id} mail={mail} />
          ))}
        </div>
      ) : (
        <Empty title={t('ui.email.empty')} />
      )}
      <Pagination {...emails} />
    </>
  )
}
