import { ArrowRight, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'
import { ErrorState, Loading } from '../../../shared/components/ui'
import '../../information/styles/information.css'

export default function FaqPage() {
  const { t } = useTranslation()
  const policy = useQuery({
    queryKey: ['public-policies'],
    queryFn: () => api('/library/policies'),
  })
  const questions = t('faq.questions', { returnObjects: true })
  const data = policy.data
  const money = (value) => `${value}${data?.currency ? ` ${data.currency}` : ''}`
  // Every figure is read from the library's own settings; fine and hold figures appear only when set.
  const rules = data && [
    [data.loanDays, t('faq.units.days'), t('faq.rules.loanDays')],
    [data.maxLoans, t('faq.units.books'), t('faq.rules.maxLoans')],
    [data.maxRenewals, t('faq.units.renewals'), t('faq.rules.maxRenewals')],
    [data.renewalDays, t('faq.units.days'), t('faq.rules.renewalDays')],
    ...(data.fineEnabled && data.finePerDay > 0
      ? [
          [money(data.finePerDay), t('faq.units.perDay'), t('faq.rules.finePerDay')],
          ...(data.graceDays > 0
            ? [[data.graceDays, t('faq.units.days'), t('faq.rules.graceDays')]]
            : []),
          ...(data.maxFine > 0 ? [[money(data.maxFine), '', t('faq.rules.maxFine')]] : []),
        ]
      : []),
    ...(data.reservationHoldDays > 0
      ? [[data.reservationHoldDays, t('faq.units.days'), t('faq.rules.holdDays')]]
      : []),
  ]
  return (
    <div className="container page information-page">
      <header className="information-heading">
        <p className="eyebrow">{t('faq.eyebrow')}</p>
        <h1>{t('faq.title')}</h1>
        <p>{t('faq.intro')}</p>
      </header>
      <section className="borrowing-policy" aria-labelledby="rules-title">
        <div>
          <h2 id="rules-title">{t('faq.rulesTitle')}</h2>
          <p className="muted">{t('faq.rulesIntro')}</p>
        </div>
        {policy.isPending ? (
          <Loading />
        ) : policy.error ? (
          <ErrorState error={policy.error} retry={() => void policy.refetch()} />
        ) : (
          <dl className="public-policy-grid">
            {rules.map(([value, unit, label]) => (
              <div key={label}>
                <dd>
                  {value}
                  {unit && <span>{unit}</span>}
                </dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        )}
      </section>
      <section className="help-questions">
        <h2>{t('faq.questionsTitle')}</h2>
        <div>
          {Array.isArray(questions) &&
            questions.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
        </div>
      </section>
      <section className="information-bottom">
        <div>
          <h2>{t('faq.readyTitle')}</h2>
          <p>{t('faq.readyText')}</p>
        </div>
        <Link className="button" to="/catalog">
          {t('home.browseAll')} <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  )
}
