import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../auth/providers/AuthProvider'
import { useAction } from '../../../shared/hooks/useAction'
import { Input } from '../../../shared/components/primitives/input'
import { PasswordInput } from '../../auth/components/PasswordInput'
import { Button } from '../../../shared/components/primitives/button'
import { PageHeading } from '../../../shared/components/ui'
import ProfilePhoto from '../components/ProfilePhoto'
export default function ProfilePage() {
  const { t } = useTranslation()
  const { user, updateUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const resetFields = () => {
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
    setCurrentPassword('')
    setPassword('')
    setConfirmPassword('')
  }
  const save = useAction('/me', 'PATCH', (updated) => {
    if (updated.requiresSignIn) {
      void signOut()
        .catch((error) => toast.error(error.message))
        .finally(() => navigate('/login', { replace: true }))
    } else {
      updateUser(updated)
      setEditing(false)
    }
  })
  const verify = useAction('/auth/resend-verification')
  const sensitive = email.trim().toLowerCase() !== user?.email || !!password
  return (
    <>
      <PageHeading
        eyebrow={t('profile.eyebrow')}
        title={t('nav.myProfile')}
        description={t('profile.intro')}
      ></PageHeading>
      <section className="panel profile-editor">
        <div className="profile-card-heading">
          <ProfilePhoto editing={editing} onUploading={setUploading} />
          {!editing && (
            <Button
              onClick={() => {
                resetFields()
                setEditing(true)
              }}
            >
              <Pencil size={17} />
              {t('profile.edit')}
            </Button>
          )}
        </div>
        {editing ? (
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault()
              if (password !== confirmPassword) {
                toast.error(t('auth.mismatch'))
                return
              }
              save.mutate({
                name,
                email,
                ...(sensitive ? { currentPassword } : {}),
                ...(password ? { password, confirmPassword } : {}),
              })
            }}
          >
            <div className="profile-edit-fields">
              <label>
                {t('auth.fullName')}
                <Input
                  placeholder={t('auth.fullNamePlaceholder')}
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                {t('auth.email')}
                <Input
                  type="email"
                  placeholder="you@example.com"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                {t('recovery.newPassword')}
                <PasswordInput
                  aria-label={t('recovery.newPassword')}
                  placeholder={t('profile.keepPassword')}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                {t('recovery.confirmNew')}
                <PasswordInput
                  aria-label={t('recovery.confirmNew')}
                  placeholder={t('auth.confirmPlaceholder')}
                  autoComplete="new-password"
                  required={!!password}
                  minLength={12}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
            </div>
            {sensitive && (
              <label>
                {t('profile.current')}
                <PasswordInput
                  aria-label={t('profile.current')}
                  placeholder={t('profile.currentHint')}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
            )}
            <p className="muted">{t('profile.note')}</p>
            <div className="button-row">
              <Button disabled={save.isPending || uploading}>{t('profile.save')}</Button>
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending || uploading}
                onClick={() => {
                  resetFields()
                  setEditing(false)
                }}
              >
                {t('staffContent.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="profile-read-fields">
            <div>
              <dt>{t('auth.fullName')}</dt>
              <dd>{user?.name}</dd>
            </div>
            <div>
              <dt>{t('auth.email')}</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>{t('auth.password')}</dt>
              <dd>{'\u2022'.repeat(12)}</dd>
            </div>
            <div>
              <dt>{t('profile.access')}</dt>
              <dd>{t(`ui.roles.${user?.role ?? 'member'}`)}</dd>
            </div>
          </dl>
        )}
        <div className="profile-verification">
          <span className="muted">
            {t('home.email')}:{' '}
            {user?.emailVerified ? t('profile.verified') : t('profile.unverified')}
          </span>
          {!user?.emailVerified && (
            <Button
              type="button"
              variant="outline"
              disabled={verify.isPending}
              onClick={() => verify.mutate()}
            >
              {t('profile.sendVerification')}
            </Button>
          )}
        </div>
      </section>
    </>
  )
}
