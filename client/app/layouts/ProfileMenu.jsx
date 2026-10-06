import { useTranslation } from 'react-i18next'
import { useEffect, useRef } from 'react'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../features/auth/providers/AuthProvider'
import UserAvatar from '../../shared/components/UserAvatar'
export default function ProfileMenu() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const menu = useRef(null)
  const trigger = useRef(null)
  useEffect(() => {
    const outside = (event) => {
      if (menu.current && !menu.current.contains(event.target)) menu.current.open = false
    }
    const escape = (event) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  return (
    <details className="profile-menu" ref={menu}>
      <summary ref={trigger} aria-label={t('ui.common.accountMenu')}>
        <UserAvatar user={user} />
        <span className="profile-menu-name">
          {user?.name}
          <small>{t(`ui.roles.${user?.role ?? 'member'}`)}</small>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="profile-dropdown">
        <Link
          to="/staff/profile"
          onClick={() => {
            if (menu.current) menu.current.open = false
          }}
        >
          <UserRound size={17} aria-hidden="true" />
          {t('nav.myProfile')}
        </Link>
        <button
          type="button"
          onClick={() => {
            if (menu.current) menu.current.open = false
            void signOut().catch((error) => toast.error(error.message))
          }}
        >
          <LogOut size={17} aria-hidden="true" />
          {t('nav.signOut')}
        </button>
      </div>
    </details>
  )
}
