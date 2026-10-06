import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useAction } from '../../../shared/hooks/useAction'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { PasswordInput } from '../../auth/components/PasswordInput'
export default function EmailConfiguration({ transport, sender, passwordConfigured }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(transport)
  const [user, setUser] = useState(sender)
  const [password, setPassword] = useState('')
  const save = useAction('/staff/email/configuration', 'PUT', () => setPassword(''))
  const test = useAction('/staff/email/configuration/test')
  return (
    <details className="email-setup">
      <summary>{t('ui.email.configure')}</summary>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate({ transport: mode, user, ...(password ? { password } : {}) })
        }}
      >
        <label>
          {t('ui.email.mode')}
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="preview">{t('ui.email.modePreview')}</option>
            <option value="smtp">Gmail SMTP</option>
          </select>
        </label>
        <label>
          {t('ui.email.sender')}
          <Input
            type="email"
            placeholder="your.name@gmail.com"
            required
            maxLength={254}
            autoComplete="off"
            value={user}
            onChange={(event) => setUser(event.target.value)}
          />
        </label>
        <label>
          {t('ui.email.appPassword')}
          <PasswordInput
            aria-label={t('ui.email.appPassword')}
            placeholder={
              passwordConfigured ? t('ui.email.keepPassword') : t('ui.email.enterPassword')
            }
            autoComplete="new-password"
            maxLength={256}
            required={mode === 'smtp' && (!passwordConfigured || user !== sender)}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <p className="muted">{t('ui.email.passwordNote')}</p>
        <Button disabled={save.isPending}>{t('ui.email.save')}</Button>
        <Button
          type="button"
          variant="outline"
          disabled={test.isPending || transport !== 'smtp'}
          onClick={() => test.mutate()}
        >
          {test.isPending ? t('ui.email.testing') : t('ui.email.test')}
        </Button>
      </form>
    </details>
  )
}
