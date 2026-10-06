import { useLibrarySettings, defaultLibrary } from '../../shared/hooks/useLibrarySettings'
import Brand from '../../shared/components/Brand'
import ThemeButton from '../../shared/components/ThemeButton'
import LanguageSelector from '../../shared/components/LanguageSelector'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { UserRoundPlus } from 'lucide-react'
import MobileNavigation from './MobileNavigation'
import { useAuth } from '../../features/auth/providers/AuthProvider'
import '../../features/information/styles/information.css'
export default function PublicLayout() {
  const { t } = useTranslation()
  const library = useLibrarySettings()
  const name = library.data?.name ?? defaultLibrary.name
  useEffect(() => {
    document.title = `${name} | Garbaharey Public Library`
  }, [name])
  const { user } = useAuth()
  return (
    <>
      <a className="skip-link" href="#main">
        {t('nav.skipToContent')}
      </a>
      <header className="public-header">
        <div className="container nav-row">
          <Brand />
          <nav aria-label={t('nav.main')} className="public-nav">
            <NavLink to="/" end>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/about">{t('nav.about')}</NavLink>
            <NavLink to="/catalog">{t('nav.catalog')}</NavLink>
            <NavLink to="/services">{t('nav.services')}</NavLink>
            <NavLink to="/how-to-join">{t('nav.howToJoin')}</NavLink>
            <NavLink to="/news">{t('nav.news')}</NavLink>
            <NavLink to="/help">{t('nav.contactUs')}</NavLink>
            {user && <NavLink to="/account">{t('nav.myLibrary')}</NavLink>}
            {user && user.role !== 'member' && (
              <NavLink to="/staff">{t('nav.staffWorkspace')}</NavLink>
            )}
          </nav>
          <div className="nav-actions">
            <LanguageSelector />
            <ThemeButton />
            <Link className="header-sign-in" to={user ? '/account' : '/login'}>
              {user ? user.name.split(' ')[0] : t('nav.signIn')}
            </Link>
            {!user && (
              <Link className="button header-register" to="/register">
                <UserRoundPlus size={18} aria-hidden="true" />
                {t('nav.register')}
              </Link>
            )}
            <MobileNavigation />
          </div>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="public-footer-shell">
        <div className="public-footer-expanded container">
          <div className="footer-intro">
            <Brand />
            <p>{t('footer.tagline')}</p>
          </div>
          <div className="footer-group">
            <h2>{t('footer.explore')}</h2>
            <nav aria-label={t('footer.exploreNav')}>
              <Link to="/catalog">{t('footer.browse')}</Link>
              <Link to="/about">{t('footer.about')}</Link>
              <Link to="/services">{t('nav.services')}</Link>
              <Link to="/rules">{t('nav.rules')}</Link>
              <Link to="/join">{t('nav.join')}</Link>
              <Link to="/help">{t('footer.contact')}</Link>
              <Link to="/faq">{t('footer.guide')}</Link>
            </nav>
          </div>
          <div className="footer-group">
            <h2>{t('footer.readingLife')}</h2>
            <nav aria-label={t('footer.accountNav')}>
              <Link to="/account">{t('footer.account')}</Link>
              <Link to="/login">{t('footer.membership')}</Link>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} {name}
            </span>
            <span>{t('footer.slogan')}</span>
          </div>
        </div>
      </footer>
    </>
  )
}
