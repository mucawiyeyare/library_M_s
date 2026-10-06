import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAction } from '../../../shared/hooks/useAction'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { MutationFeedback } from '../../../shared/components/ui'

// The API stores the topic in English; only the visible labels are translated.
const topics = ['Borrowing', 'Membership', 'Reservations', 'Other']

export default function ContactForm() {
  const { t } = useTranslation()
  const form = useRef(null)
  const action = useAction('/contact', 'POST', () => form.current?.reset())
  return (
    <section className="contact-form-panel" aria-labelledby="message-title">
      <h2 id="message-title">{t('contact.formTitle')}</h2>
      <p className="muted">{t('contact.formIntro')}</p>
      <form
        className="form-stack"
        ref={form}
        onSubmit={(event) => {
          event.preventDefault()
          action.mutate(Object.fromEntries(new FormData(event.currentTarget)))
        }}
      >
        <div className="form-grid">
          <label>
            {t('auth.fullName')}
            <Input
              name="name"
              placeholder={t('auth.fullNamePlaceholder')}
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            {t('auth.email')}
            <Input
              name="email"
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              dir="ltr"
            />
          </label>
        </div>
        <label>
          {t('contact.topicLabel')}
          <select name="subject" required defaultValue="">
            <option value="" disabled>
              {t('contact.topicPlaceholder')}
            </option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>
                {t(`contact.topics.${topic}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('contact.message')}
          <textarea
            name="message"
            rows={5}
            placeholder={t('contact.messagePlaceholder')}
            required
            minLength={10}
            maxLength={3000}
          />
        </label>
        <small className="muted">{t('contact.noSecrets')}</small>
        <MutationFeedback error={action.error} />
        <Button disabled={action.isPending}>
          {action.isPending ? t('contact.sending') : t('contact.send')}
        </Button>
      </form>
    </section>
  )
}
