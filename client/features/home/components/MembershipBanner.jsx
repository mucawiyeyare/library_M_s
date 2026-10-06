import { ArrowRight, Bookmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/providers/AuthProvider'
export default function MembershipBanner() {
  const { t } = useTranslation()
  const { user } = useAuth()
  return (
    <section className="reader-membership">
      <div className="membership-symbol" aria-hidden="true">
        <Bookmark size={35} strokeWidth={1.4} />
      </div>
      <div>
        <p className="eyebrow">{t('home.banner.eyebrow')}</p>
        <h2>{user ? t('home.banner.signedIn') : t('home.banner.signedOut')}</h2>
        <p>{t('home.banner.text')}</p>
      </div>
      <Link className="button" to={user ? '/account' : '/join'}>
        {user ? t('home.banner.open') : t('home.banner.join')}
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </section>
  )
}
