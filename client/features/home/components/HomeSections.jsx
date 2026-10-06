import { ArrowRight, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookTile } from '../../catalog/components/BookTile'
import { useLibrarySettings } from '../../../shared/hooks/useLibrarySettings'

function Heading({ eyebrow, title, intro, to, link }) {
  return (
    <div className="reader-section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {intro && <p className="muted">{intro}</p>}
      </div>
      {to && (
        <Link to={to} className="button secondary">
          {link} <ArrowRight size={17} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

// Live figures from the catalogue. Nothing here is typed in by hand.
export function StatsBand({ stats }) {
  const { t, i18n } = useTranslation()
  const items = [
    ['titles', stats.titles],
    ['available', stats.available],
    ['members', stats.members],
    ['services', stats.services],
  ]
  return (
    <section className="home-stats" aria-label={t('home.statsLabel')}>
      {items.map(([key, value]) => (
        <div key={key}>
          <strong>{value.toLocaleString(i18n.language)}</strong>
          <span>{t(`home.stats.${key}`)}</span>
        </div>
      ))}
    </section>
  )
}

export function BookShelf({ id, eyebrow, title, intro, books }) {
  const { t } = useTranslation()
  if (!books.length) return null
  return (
    <section className="reader-collection" aria-labelledby={id}>
      <Heading
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        to="/catalog"
        link={t('home.browseAll')}
      />
      <div className="book-grid">
        {books.map((book) => (
          <BookTile key={book._id} book={book} />
        ))}
      </div>
    </section>
  )
}

export function PopularCategories({ categories }) {
  const { t } = useTranslation()
  if (!categories.length) return null
  return (
    <section className="home-categories" aria-labelledby="home-categories-title">
      <Heading
        eyebrow={t('home.categoriesEyebrow')}
        title={t('home.categoriesTitle')}
        to="/catalog"
        link={t('home.browseAll')}
      />
      <div className="home-chip-row">
        {categories.map((category) => (
          <Link key={category._id} to={`/catalog?category=${category._id}`}>
            {category.name} <small>{category.books}</small>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function ServicesPreview({ services }) {
  const { t } = useTranslation()
  if (!services.length) return null
  return (
    <section className="home-services" aria-labelledby="home-services-title">
      <Heading
        eyebrow={t('home.servicesEyebrow')}
        title={t('home.servicesTitle')}
        to="/services"
        link={t('home.allServices')}
      />
      <div className="content-cards">
        {services.map((service) => (
          <article key={service._id}>
            <h3>{service.title}</h3>
            <p>
              {service.body.slice(0, 140)}
              {service.body.length > 140 ? '…' : ''}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function Announcements({ items }) {
  const { t, i18n } = useTranslation()
  if (!items.length) return null
  const date = (value) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(value),
    )
  return (
    <section className="home-announcements" aria-labelledby="home-news-title">
      <Heading
        eyebrow={t('home.newsEyebrow')}
        title={t('home.newsTitle')}
        to="/news"
        link={t('home.allNews')}
      />
      <div className="content-cards">
        {items.map((item) => (
          <article key={item._id}>
            {item.featured && <span className="content-badge">{t('pages.news.featured')}</span>}
            <time className="muted">{date(item.eventDate ?? item.createdAt)}</time>
            <h3>
              <Link to={`/news/${item._id}`}>{item.title}</Link>
            </h3>
            <p>
              {item.body.slice(0, 120)}
              {item.body.length > 120 ? '…' : ''}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

// Opening hours and contact details come from the library settings; empty fields are not shown.
export function HoursAndContact() {
  const { t } = useTranslation()
  const library = useLibrarySettings()
  const data = library.data
  const rows = [
    [Clock, t('home.hours'), data?.hours],
    [MapPin, t('home.address'), data?.address],
    [Phone, t('home.phone'), data?.phone],
    [Mail, t('home.email'), data?.email],
  ].filter(([, , value]) => value)
  if (!rows.length) return null
  return (
    <section className="home-hours" aria-labelledby="home-hours-title">
      <Heading
        eyebrow={t('home.visitEyebrow')}
        title={t('home.visitTitle')}
        to="/contact"
        link={t('home.contactUs')}
      />
      <dl>
        {rows.map(([Icon, label, value]) => (
          <div key={label}>
            <dt>
              <Icon size={18} aria-hidden="true" /> {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
