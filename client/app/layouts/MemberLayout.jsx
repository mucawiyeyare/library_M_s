import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Bell,
  BookMarked,
  BookOpen,
  Bookmark,
  Clock,
  Coins,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  UserRound,
  X,
} from 'lucide-react'
import Brand from '../../shared/components/Brand'
import ThemeButton from '../../shared/components/ThemeButton'
import LanguageSelector from '../../shared/components/LanguageSelector'
import UserAvatar from '../../shared/components/UserAvatar'
import { api } from '../../shared/lib/api'
import { useAuth } from '../../features/auth/providers/AuthProvider'

// Member portal: sidebar plus the member's own pages. Members only ever see their own records.
const links = [
  { to: '/account', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/catalog', key: 'browse', icon: BookOpen },
  { to: '/account/books', key: 'myBooks', icon: BookMarked },
  { to: '/account/reservations', key: 'reservations', icon: Clock },
  { to: '/account/history', key: 'history', icon: Clock },
  { to: '/account/fines', key: 'fines', icon: Coins },
  { to: '/account/reading-list', key: 'readingList', icon: Bookmark },
  { to: '/account/notifications', key: 'notifications', icon: Bell, badge: true },
  { to: '/account/profile', key: 'profile', icon: UserRound },
  { to: '/account/settings', key: 'settings', icon: Settings2 },
]

export default function MemberLayout() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const summary = useQuery({ queryKey: ['account-summary'], queryFn: () => api('/me/summary') })
  const current = links.find((link) => link.to === location.pathname)
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        {t('nav.skipToContent')}
      </a>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand-header">
          <Brand />
        </div>
        <p className="sidebar-label">{t('member.portal')}</p>
        <nav aria-label={t('member.portal')}>
          {links.map(({ to, key, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}>
              <Icon size={19} aria-hidden="true" />
              {t(`member.nav.${key}`)}
              {badge && summary.data?.unreadNotices > 0 && (
                <span className="nav-badge">{summary.data.unreadNotices}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-preferences">
          <LanguageSelector />
          <ThemeButton />
        </div>
        <div className="sidebar-footer">
          <button
            type="button"
            onClick={() => {
              void signOut().catch((error) => toast.error(error.message))
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            {t('nav.signOut')}
          </button>
        </div>
      </aside>
      <div className="workspace-content">
        <header className="workspace-header">
          <div className="flex items-center gap-3">
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label={t('nav.toggle')}
              aria-expanded={open}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>
              {t('member.portal')} <span className="muted">/</span>{' '}
              <strong>{t(`member.nav.${current?.key ?? 'dashboard'}`)}</strong>
            </span>
          </div>
          <div className="nav-actions">
            <LanguageSelector />
            <ThemeButton />
            <span className="profile-menu-name">
              <UserAvatar user={user} />
              {user?.name}
            </span>
          </div>
        </header>
        <main id="main" className="staff-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
