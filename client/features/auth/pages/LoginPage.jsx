import { toast } from 'sonner'
import { Input } from '../../../shared/components/primitives/input'
import { PasswordInput } from '../components/PasswordInput'
import { Button } from '../../../shared/components/primitives/button'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { loginSchema, registerSchema } from '../../../../server/contracts/schemas'
import { useAuth } from '../providers/AuthProvider'
import { Loading } from '../../../shared/components/ui'
import { BookOpen } from 'lucide-react'
import '../styles/auth.css'
export default function Login() {
  const { t } = useTranslation()
  const { user, loading, signIn } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const registering = location.pathname === '/register'
  const schema = registering
    ? registerSchema
        .extend({ confirmPassword: z.string() })
        .refine((values) => values.password === values.confirmPassword, {
          path: ['confirmPassword'],
          message: t('auth.mismatch'),
        })
    : loginSchema.extend({ name: z.string().optional(), confirmPassword: z.string().optional() })
  const form = useForm({
    resolver: zodResolver(schema),
  })
  if (loading) return <Loading />
  if (user)
    return (
      <Navigate
        to={location.state?.from ?? (user.role === 'member' ? '/account' : '/staff')}
        replace
      />
    )
  return (
    <div className="auth-screen">
      <section className={`auth-card${registering ? ' auth-card-register' : ''}`}>
        <div className="auth-mark" aria-hidden="true">
          <BookOpen size={25} />
        </div>
        <h1>{registering ? t('auth.becomeMember') : t('auth.welcomeBack')}</h1>
        <p className="muted">
          {registering ? t('auth.registerSubtitle') : t('auth.signInSubtitle')}
        </p>
        <form
          className="form-stack"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await signIn(
                { name: values.name, email: values.email, password: values.password },
                registering,
              )
              toast.success(registering ? t('auth.accountReady') : t('auth.signedIn'))
            } catch (err) {
              toast.error(err.message, { duration: 7000 })
            }
          })}
        >
          <div className={registering ? 'auth-fields auth-fields-register' : 'auth-fields'}>
            {registering && (
              <label>
                {t('auth.fullName')}
                <Input
                  placeholder={t('auth.fullNamePlaceholder')}
                  autoComplete="name"
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <span className="form-error">{form.formState.errors.name.message}</span>
                )}
              </label>
            )}
            <label>
              {t('auth.email')}
              <Input
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <span className="form-error">{form.formState.errors.email.message}</span>
              )}
            </label>
            <label>
              {t('auth.password')}
              <PasswordInput
                placeholder={
                  registering ? t('auth.newPasswordPlaceholder') : t('auth.passwordPlaceholder')
                }
                aria-label={t('auth.password')}
                autoComplete={registering ? 'new-password' : 'current-password'}
                {...form.register('password')}
              />
              {registering && <small className="muted">{t('auth.passwordHint')}</small>}
              {form.formState.errors.password && (
                <span className="form-error">{form.formState.errors.password.message}</span>
              )}
            </label>
            {registering && (
              <label>
                {t('auth.confirmPassword')}
                <PasswordInput
                  placeholder={t('auth.confirmPlaceholder')}
                  aria-label={t('auth.confirmPassword')}
                  autoComplete="new-password"
                  {...form.register('confirmPassword')}
                />
                {form.formState.errors.confirmPassword && (
                  <span className="form-error">
                    {form.formState.errors.confirmPassword.message}
                  </span>
                )}
              </label>
            )}
          </div>
          {!registering && (
            <Link className="text-link auth-forgot" to="/forgot-password">
              {t('auth.forgot')}
            </Link>
          )}
          <Button className="button" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t('auth.wait')
              : registering
                ? t('auth.createAccount')
                : t('nav.signIn')}
          </Button>
        </form>
        <p className="auth-switch">
          {registering ? t('auth.alreadyMember') : t('auth.newHere')}{' '}
          <button
            className="text-link"
            onClick={() => {
              navigate(registering ? '/login' : '/register', { state: location.state })
              form.reset()
            }}
          >
            {registering ? t('nav.signIn') : t('auth.createAnAccount')}
          </button>
        </p>
      </section>
    </div>
  )
}
