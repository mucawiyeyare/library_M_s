import Brand from '../../shared/components/Brand'
import ThemeButton from '../../shared/components/ThemeButton'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Library,
  Users,
  ArrowRightLeft,
  ClipboardList,
  BarChart3,
  Settings2,
  Menu,
  X,
  ShieldCheck,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../../features/auth/providers/AuthProvider'
import ProfileMenu from './ProfileMenu'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import LanguageSelector from '../../shared/components/LanguageSelector'
const staffLinks = [
  { to: '/staff', label: 'overview', access: 'all', icon: LayoutDashboard },
  { to: '/staff/inventory', label: 'books', access: 'ops', icon: Library },
  { to: '/staff/categories', label: 'categories', access: 'ops', icon: Library },
  { to: '/staff/authors', label: 'authors', access: 'ops', icon: Library },
  { to: '/staff/publishers', label: 'publishers', access: 'ops', icon: Library },
  { to: '/staff/members', label: 'members', access: 'ops', icon: Users },
  { to: '/staff/circulation', label: 'circulation', access: 'ops', icon: ArrowRightLeft },
  { to: '/staff/reservations', label: 'reservations', access: 'ops', icon: ClipboardList },
  { to: '/staff/fines', label: 'fines', access: 'mgmt', icon: ClipboardList },
  { to: '/staff/applications', label: 'applications', access: 'ops', icon: ClipboardList },
  { to: '/staff/content', label: 'siteContent', access: 'ops', icon: ClipboardList },
  { to: '/staff/contact', label: 'contact', access: 'ops', icon: ClipboardList },
  { to: '/staff/email', label: 'email', access: 'admin', icon: ClipboardList },
  { to: '/staff/reports', label: 'reports', access: 'mgmt', icon: BarChart3 },
  { to: '/staff/team', label: 'team', access: 'admin', icon: ShieldCheck },
  { to: '/staff/audit', label: 'audit', access: 'audit', icon: ShieldCheck },
  { to: '/staff/policies', label: 'policies', access: 'admin', icon: Settings2 },
  { to: '/staff/settings', label: 'settings', access: 'admin', icon: Settings2 },
]
// Which roles see each group of links (the API enforces the same limits).
const accessRoles = {
  all: ['admin', 'librarian', 'director'],
  ops: ['admin', 'librarian'],
  mgmt: ['admin', 'librarian', 'director'],
  audit: ['admin', 'director'],
  admin: ['admin'],
}
export default function StaffLayout() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const current = staffLinks.find((link) => link.to === location.pathname)
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        {t('nav.skipToContent')}
      </a>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand-header">
          <Brand />
        </div>
        <p className="sidebar-label">{t('nav.workspace')}</p>
        <nav aria-label={t('nav.staff')}>
          {staffLinks
            .filter((link) => accessRoles[link.access].includes(user?.role))
            .map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/staff'} onClick={() => setOpen(false)}>
                <Icon size={19} />
                {t(`nav.${label}`)}
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
              aria-label={t('nav.toggleStaff')}
              aria-expanded={open}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>
              {t('nav.workspaceCrumb')} <span className="muted">/</span>{' '}
              <strong>
                {current
                  ? t(`nav.${current.label}`)
                  : location.pathname === '/staff/profile'
                    ? t('nav.myProfile')
                    : t('nav.overview')}
              </strong>
            </span>
          </div>
          <div className="nav-actions">
            <LanguageSelector />
            <ThemeButton />
            <ProfileMenu />
          </div>
        </header>
        <main id="main" className="staff-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
