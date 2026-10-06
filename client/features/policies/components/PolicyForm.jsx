import { useAction } from '../../../shared/hooks/useAction'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { policySchema } from '../../../../server/contracts/schemas'
import { MutationFeedback } from '../../../shared/components/ui'
export default function PolicyForm({ policy }) {
  const { t } = useTranslation()
  const form = useForm({ resolver: zodResolver(policySchema), defaultValues: policy })
  const action = useAction('/staff/policies', 'PUT')
  return (
    <form className="form-stack" onSubmit={form.handleSubmit((values) => action.mutate(values))}>
      <div className="form-grid">
        {[
          {
            key: 'loanDays',
            label: t('ui.policy.loanDays'),
            help: t('ui.policy.loanDaysHelp'),
          },
          { key: 'maxLoans', label: t('ui.policy.maxLoans'), help: t('ui.policy.maxLoansHelp') },
          {
            key: 'maxRenewals',
            label: t('ui.policy.maxRenewals'),
            help: t('ui.policy.maxRenewalsHelp'),
          },
          {
            key: 'renewalDays',
            label: t('ui.policy.renewalDays'),
            help: t('ui.policy.renewalDaysHelp'),
          },
        ].map(({ key, label, help }) => (
          <label key={key}>
            {label}
            <Input
              placeholder={
                key === 'loanDays' || key === 'renewalDays'
                  ? t('ui.policy.daysPlaceholder')
                  : t('ui.policy.countPlaceholder')
              }
              type="number"
              {...form.register(key, { valueAsNumber: true })}
            />
            <small className="muted">{help}</small>
            {form.formState.errors[key] && (
              <span className="form-error">{form.formState.errors[key]?.message}</span>
            )}
          </label>
        ))}
      </div>
      <h2>{t('policy.fines')}</h2>
      <p className="muted">{t('policy.note')}</p>
      <label className="checkbox-label">
        <Input type="checkbox" {...form.register('fineEnabled')} />
        {t('policy.enable')}
      </label>
      <div className="form-grid">
        {[
          ['finePerDay', 'policy.perDay', '0.01'],
          ['graceDays', 'policy.grace', '1'],
          ['maxFine', 'policy.max', '0.01'],
          ['reservationHoldDays', 'policy.hold', '1'],
        ].map(([key, text, step]) => (
          <label key={key}>
            {t(text)}
            <Input
              type="number"
              min="0"
              step={step}
              {...form.register(key, { valueAsNumber: true })}
            />
            {form.formState.errors[key] && (
              <span className="form-error">{form.formState.errors[key]?.message}</span>
            )}
          </label>
        ))}
        <label>
          {t('policy.currency')}
          <Input maxLength={10} {...form.register('currency')} />
        </label>
      </div>
      <p className="muted">{t('ui.policy.note')}</p>
      <MutationFeedback error={action.error} success={action.isSuccess} />
      <Button className="button" disabled={action.isPending}>
        {t('ui.policy.save')}
      </Button>
    </form>
  )
}
