import { ArrowRight, BookOpen, Bookmark, Library } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
export default function LibraryGuide() {
  const { t } = useTranslation()
  return (
    <section className="reader-guide" aria-labelledby="guide-title">
      <div className="reader-guide-intro">
        <p className="eyebrow">{t('home.guide.eyebrow')}</p>
        <h2 id="guide-title">
          {t('home.guide.title1')}
          <br />
          {t('home.guide.title2')}
        </h2>
        <p>{t('home.guide.intro')}</p>
        <Link to="/faq" className="text-link">
          {t('home.guide.how')} <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <div className="reader-guide-items">
        <Link to="/catalog">
          <span className="guide-icon">
            <BookOpen size={24} aria-hidden="true" />
          </span>
          <div>
            <h3>{t('home.guide.findTitle')}</h3>
            <p>{t('home.guide.findText')}</p>
          </div>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/account">
          <span className="guide-icon">
            <Bookmark size={24} aria-hidden="true" />
          </span>
          <div>
            <h3>{t('home.guide.keepTitle')}</h3>
            <p>{t('home.guide.keepText')}</p>
          </div>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/faq">
          <span className="guide-icon">
            <Library size={24} aria-hidden="true" />
          </span>
          <div>
            <h3>{t('home.guide.collectTitle')}</h3>
            <p>{t('home.guide.collectText')}</p>
          </div>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
