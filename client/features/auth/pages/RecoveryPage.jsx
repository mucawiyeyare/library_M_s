import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'
import { toast } from 'sonner'
import { useAuth } from '../providers/AuthProvider'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { useAction } from '../../../shared/hooks/useAction'
import { PasswordInput } from '../components/PasswordInput'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import '../styles/auth.css'
export default function RecoveryPage() {
  const { t } = useTranslation()
  const location = useLocation(),
    [params] = useSearchParams()
  const reset = location.pathname === '/reset-password',
    verify = location.pathname === '/verify-email'
  const { user, updateUser, signOut } = useAuth()
  const token = params.get('token') ?? ''
  const RecoveryInput = reset ? PasswordInput : Input
  const action = useAction(
    verify ? '/auth/verify-email' : reset ? '/auth/reset-password' : '/auth/forgot-password',
    'POST',
    () => {
      if (verify && user)
        void api('/me')
          .then(updateUser)
          .catch(() => {})
      if (reset) void signOut().catch(() => {})
    },
  )
  return (
    <div className="auth-screen">
      <section className="auth-card">
        <div className="auth-mark">
          <BookOpen size={25} />
        </div>
        <h1>
          {verify
            ? t('recovery.verifyTitle')
            : reset
              ? t('recovery.resetTitle')
              : t('recovery.forgotTitle')}
        </h1>
        <p className="muted">
          {verify
            ? t('recovery.verifyIntro')
            : reset
              ? t('recovery.resetIntro')
              : t('recovery.forgotIntro')}
        </p>
        {action.isSuccess ? (
          <p className="recovery-result" role="status">
            {verify ? t('recovery.verified') : reset ? t('recovery.updated') : t('recovery.sent')}
          </p>
        ) : (reset || verify) && !token ? (
          <p className="form-error">{t('recovery.incomplete')}</p>
        ) : (
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              if (reset && data.get('password') !== data.get('confirmPassword')) {
                toast.error(t('auth.mismatch'))
                return
              }
              action.mutate(
                verify
                  ? { token }
                  : reset
                    ? { token, password: data.get('password') }
                    : { email: data.get('email') },
              )
            }}
          >
            {!verify && (
              <label>
                {reset ? t('recovery.newPassword') : t('auth.email')}
                <RecoveryInput
                  aria-label={reset ? t('recovery.newPassword') : t('auth.email')}
                  name={reset ? 'password' : 'email'}
                  type={reset ? 'password' : 'email'}
                  autoComplete={reset ? 'new-password' : 'email'}
                  minLength={reset ? 12 : undefined}
                  maxLength={reset ? 128 : 254}
                  placeholder={reset ? t('auth.newPasswordPlaceholder') : 'you@example.com'}
                  required
                />
              </label>
            )}
            {reset && (
              <label>
                {t('recovery.confirmNew')}
                <PasswordInput
                  aria-label={t('recovery.confirmNew')}
                  name="confirmPassword"
                  type="password"
                  placeholder={t('auth.confirmPlaceholder')}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </label>
            )}
            <Button disabled={action.isPending}>
              {action.isPending
                ? t('auth.wait')
                : verify
                  ? t('recovery.verifyButton')
                  : reset
                    ? t('recovery.updateButton')
                    : t('recovery.sendButton')}
            </Button>
          </form>
        )}
        <p className="auth-switch">
          <Link className="text-link" to="/login">
            {t('recovery.back')}
          </Link>
        </p>
      </section>
    </div>
  )
}
