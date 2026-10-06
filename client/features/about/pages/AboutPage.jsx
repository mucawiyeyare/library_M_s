import { useLibrarySettings, defaultLibrary } from '../../../shared/hooks/useLibrarySettings'
import { ArrowRight, BookOpen, Bookmark, Clock, Library } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'
import { Paragraphs } from '../../content/components/ContentPage'
import { usePublicContent } from '../../content/hooks/usePublicContent'
import '../../information/styles/information.css'
import '../../content/styles/content.css'
import '../styles/about.css'

export default function AboutPage() {
  const { t, i18n } = useTranslation()
  const library = useLibrarySettings()
  const counts = useQuery({ queryKey: ['library-stats'], queryFn: () => api('/books/stats') })
  // History, mission, vision, goals and the director's message are written by the library in
  // Staff → Site content. Nothing is invented here: no content means no section.
  const about = usePublicContent('about')
  const stats = [
    ['titles', counts.data?.titles],
    ['copies', counts.data?.copies],
    ['members', counts.data?.members],
    ['loans', counts.data?.loans],
  ]
  const name = library.data?.name ?? defaultLibrary.name
  return (
    <div className="about-page">
      <header className="about-heading">
        <div className="container about-heading-content">
          <p className="eyebrow">{t('about.eyebrow', { name: name.toUpperCase() })}</p>
          <h1>
            {t('about.title1')}
            <br />
            <span>{t('about.title2')}</span>
          </h1>
          <p>{t('about.intro', { name })}</p>
        </div>
      </header>
      <div className="container page information-page">
        <section className="information-split">
          <div>
            <h2>{t('about.builtTitle')}</h2>
            <p>{t('about.builtText1')}</p>
            <p>{t('about.builtText2')}</p>
            <Link className="button" to="/catalog">
              {t('about.findRead')} <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="about-services">
            <article>
              <BookOpen size={26} aria-hidden="true" />
              <h3>{t('about.discoverTitle')}</h3>
              <p>{t('about.discoverText')}</p>
            </article>
            <article>
              <Bookmark size={26} aria-hidden="true" />
              <h3>{t('about.personalTitle')}</h3>
              <p>{t('about.personalText')}</p>
            </article>
            <article>
              <Library size={26} aria-hidden="true" />
              <h3>{t('about.connectedTitle')}</h3>
              <p>{t('about.connectedText')}</p>
            </article>
          </div>
        </section>
        <section className="about-stats" aria-label={t('about.statsLabel')}>
          {stats.map(([key, value]) => (
            <div key={key}>
              <strong>{value?.toLocaleString(i18n.language) ?? '—'}</strong>
              <span>{t(`about.stats.${key}`)}</span>
            </div>
          ))}
        </section>
        {about.data?.length > 0 && (
          <div className="content-sections about-editable">
            {about.data.map((item) => (
              <article key={item._id}>
                <h2>{item.title}</h2>
                <Paragraphs text={item.body} />
              </article>
            ))}
          </div>
        )}
        {library.data?.hours && (
          <section className="about-hours">
            <h2>
              <Clock size={22} aria-hidden="true" /> {t('home.hours')}
            </h2>
            <p>{library.data.hours}</p>
          </section>
        )}
        <section className="information-bottom">
          <div>
            <h2>{t('about.newTitle')}</h2>
            <p>{t('about.newText')}</p>
          </div>
          <Link className="button secondary" to="/faq">
            {t('about.guide')} <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  )
}
