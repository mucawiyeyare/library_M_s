import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { usePublicContent } from '../hooks/usePublicContent'
import { Empty, ErrorState, Loading } from '../../../shared/components/ui'
import '../styles/content.css'

export function Paragraphs({ text }) {
  return text
    .split(/\n+/)
    .filter(Boolean)
    .map((line, index) => <p key={index}>{line}</p>)
}

export function ContentHeading({ eyebrow, title, intro, children }) {
  return (
    <header className="about-heading">
      <div className="container about-heading-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{intro}</p>
        {children}
      </div>
    </header>
  )
}

// A public page made of editable sections, with loading, empty and error states.
export default function ContentPage({ kind, page, footer, cards = false }) {
  const { t } = useTranslation()
  const content = usePublicContent(kind)
  return (
    <div className="content-page">
      <ContentHeading
        eyebrow={t(`pages.${page}.eyebrow`)}
        title={t(`pages.${page}.title`)}
        intro={t(`pages.${page}.intro`)}
      />
      <div className="container page content-body">
        {content.isPending ? (
          <Loading />
        ) : content.error ? (
          <ErrorState error={content.error} retry={() => void content.refetch()} />
        ) : content.data.length ? (
          <div className={cards ? 'content-cards' : 'content-sections'}>
            {content.data.map((item) => (
              <article key={item._id}>
                <h2>{item.title}</h2>
                <Paragraphs text={item.body} />
              </article>
            ))}
          </div>
        ) : (
          <Empty title={t('pages.empty.title')}>
            <p className="muted">{t('pages.empty.text')}</p>
          </Empty>
        )}
        {footer}
      </div>
    </div>
  )
}

export function JoinButton({ label }) {
  return (
    <Link className="button" to="/join">
      {label}
    </Link>
  )
}
