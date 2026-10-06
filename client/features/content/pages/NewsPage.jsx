import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'
import { Empty, ErrorState, Loading } from '../../../shared/components/ui'
import { ContentHeading, Paragraphs } from '../components/ContentPage'
import { usePublicContent } from '../hooks/usePublicContent'
import '../styles/content.css'

function useDate() {
  const { i18n } = useTranslation()
  return (value) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: 'UTC' }).format(
          new Date(value),
        )
      : ''
}

function List({ kind }) {
  const { t } = useTranslation()
  const date = useDate()
  const content = usePublicContent(kind)
  if (content.isPending) return <Loading />
  if (content.error)
    return <ErrorState error={content.error} retry={() => void content.refetch()} />
  if (!content.data.length)
    return (
      <Empty title={t('pages.empty.title')}>
        <p className="muted">{t('pages.empty.text')}</p>
      </Empty>
    )
  return (
    <div className="content-cards">
      {content.data.map((item) => (
        <article key={item._id}>
          {item.featured && <span className="content-badge">{t('pages.news.featured')}</span>}
          {(item.eventDate || item.createdAt) && (
            <time className="muted">{date(item.eventDate ?? item.createdAt)}</time>
          )}
          <h2>
            <Link to={`/news/${item._id}`}>{item.title}</Link>
          </h2>
          <p>
            {item.body.slice(0, 160)}
            {item.body.length > 160 ? '…' : ''}
          </p>
        </article>
      ))}
    </div>
  )
}

export default function NewsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('news')
  return (
    <div className="content-page">
      <ContentHeading
        eyebrow={t('pages.news.eyebrow')}
        title={t('pages.news.title')}
        intro={t('pages.news.intro')}
      />
      <div className="container page content-body">
        <div className="segmented content-tabs" role="group" aria-label={t('pages.news.title')}>
          {['news', 'event'].map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={tab === kind}
              onClick={() => setTab(kind)}
            >
              {t(kind === 'news' ? 'pages.news.news' : 'pages.news.events')}
            </button>
          ))}
        </div>
        <List kind={tab} />
      </div>
    </div>
  )
}

export function NewsDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const date = useDate()
  const item = useQuery({
    queryKey: ['public-content-item', id, i18n.language],
    queryFn: () => api(`/library/content/item/${id}?lang=${i18n.language}`),
  })
  return (
    <div className="container page content-detail">
      <Link className="text-link" to="/news">
        {t('pages.news.back')}
      </Link>
      {item.isPending ? (
        <Loading />
      ) : item.error ? (
        <ErrorState error={item.error} />
      ) : (
        <article>
          {item.data.kind === 'event' && item.data.eventDate && (
            <p className="muted">
              {t('pages.news.eventDate')}: {date(item.data.eventDate)}
            </p>
          )}
          <h1>{item.data.title}</h1>
          <Paragraphs text={item.data.body} />
        </article>
      )}
    </div>
  )
}
