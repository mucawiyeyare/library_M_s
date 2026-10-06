import { useTranslation } from 'react-i18next'
import { useAction } from '../../../shared/hooks/useAction'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { PasswordInput } from '../../auth/components/PasswordInput'
import { MutationFeedback } from '../../../shared/components/ui'
import { useAuth } from '../../auth/providers/AuthProvider'
export default function MemberForm({ member, onSaved, team = false }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [name, setName] = useState(member?.name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState(member?.status ?? 'active')
  const [role, setRole] = useState(member?.role ?? (team ? 'librarian' : 'member'))
  const action = useAction(
    member ? `/staff/members/${member._id}` : '/staff/members',
    member ? 'PATCH' : 'POST',
    onSaved,
  )
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault()
        if (!member && password !== confirmPassword) {
          toast.error(t('auth.mismatch'))
          return
        }
        action.mutate(
          member ? { name, status, role } : { name, email, password, ...(team ? { role } : {}) },
        )
      }}
    >
      <label>
        {t('auth.fullName')}
        <Input
          required
          minLength={2}
          maxLength={100}
          placeholder={t('auth.fullNamePlaceholder')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        {t('auth.email')}
        <Input
          required
          type="email"
          readOnly={!!member}
          placeholder={team ? 'staff@example.com' : 'member@example.com'}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {!member && (
        <label>
          {t('ui.members.initialPassword')}
          <PasswordInput
            aria-label={t('ui.members.initialPassword')}
            placeholder={t('auth.newPasswordPlaceholder')}
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <small className="muted">{t('ui.members.passwordHint')}</small>
        </label>
      )}
      {!member && (
        <label>
          {t('auth.confirmPassword')}
          <PasswordInput
            aria-label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPlaceholder')}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
      )}
      {!member && team && (
        <label>
          {t('ui.members.role')}
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="librarian">{t('ui.roles.librarian')}</option>
            <option value="director">{t('ui.roles.director')}</option>
            <option value="admin">{t('ui.roles.admin')}</option>
          </select>
        </label>
      )}
      {member && (
        <>
          <label>
            {t('ui.members.status')}
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">{t('taxonomy.active')}</option>
              <option value="suspended">{t('ui.members.suspended')}</option>
            </select>
          </label>
          <label>
            {t('ui.members.role')}
            <select
              disabled={user?.role !== 'admin'}
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="member">{t('ui.roles.member')}</option>
              <option value="librarian">{t('ui.roles.librarian')}</option>
              <option value="director">{t('ui.roles.director')}</option>
              <option value="admin">{t('ui.roles.admin')}</option>
            </select>
          </label>
        </>
      )}
      <MutationFeedback error={action.error} />
      <Button className="button" disabled={action.isPending}>
        {action.isPending
          ? t('staffContent.saving')
          : member
            ? t('ui.members.save')
            : team
              ? t('ui.members.createStaff')
              : t('ui.members.register')}
      </Button>
    </form>
  )
}
