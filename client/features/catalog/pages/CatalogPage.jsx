import { BookTile } from '../components/BookTile'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'
import { Empty, ErrorState, Loading, PageHeading } from '../../../shared/components/ui'
export default function Catalog() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? params.get('query') ?? ''
  const [input, setInput] = useState(q)
  const query = new URLSearchParams(params)
  query.set('q', q)
  query.set('lang', i18n.language)
  const books = useQuery({
    queryKey: ['books', query.toString()],
    queryFn: () => api(`/books?${query}`),
  })
  const update = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }
  return (
    <div className="container page">
      <PageHeading
        eyebrow={t('catalog.eyebrow')}
        title={t('catalog.title')}
        description={t('catalog.description')}
      />
      <div className="catalog-controls">
        <form
          className="search-input"
          onSubmit={(event) => {
            event.preventDefault()
            update('q', input)
          }}
        >
          <Search size={19} />
          <Input
            aria-label={t('catalog.searchLabel')}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('catalog.placeholder')}
          />
          <Button className="button secondary" type="submit">
            {t('catalog.search')}
          </Button>
        </form>
        <label className="select-label">
          <SlidersHorizontal size={17} />
          <span className="sr-only">{t('catalog.category')}</span>
          <select
            value={params.get('category') ?? ''}
            onChange={(event) => update('category', event.target.value)}
          >
            <option value="">{t('catalog.allCategories')}</option>
            {books.data?.categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="select-label">
          <span className="sr-only">{t('catalog.language')}</span>
          <select
            value={params.get('language') ?? ''}
            onChange={(event) => update('language', event.target.value)}
          >
            <option value="">{t('catalog.allLanguages')}</option>
            {books.data?.languages.map((language) => (
              <option key={language} value={language}>
                {t(`catalog.languages.${language}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="select-label">
          <span className="sr-only">{t('catalog.year')}</span>
          <input
            type="number"
            min="1000"
            max="3000"
            placeholder={t('catalog.year')}
            value={params.get('year') ?? ''}
            onChange={(event) => update('year', event.target.value)}
          />
        </label>
        <label className="select-label">
          <span className="sr-only">{t('catalog.sort')}</span>
          <select
            value={params.get('sort') ?? 'title'}
            onChange={(event) => update('sort', event.target.value)}
          >
            <option value="title">{t('catalog.sortTitle')}</option>
            <option value="newest">{t('catalog.sortNewest')}</option>
          </select>
        </label>
      </div>
      <div className="catalog-summary">
        <span className="muted">
          {books.data ? t('catalog.count', { count: books.data.total }) : t('catalog.finding')}
        </span>
        <label className="checkbox-label">
          <Input
            type="checkbox"
            checked={params.get('available') === 'true'}
            onChange={(event) => update('available', event.target.checked ? 'true' : '')}
          />
          {t('catalog.availableOnly')}
        </label>
      </div>
      {books.isPending ? (
        <Loading />
      ) : books.error ? (
        <ErrorState
          error={books.error}
          retry={() => {
            void books.refetch()
          }}
        />
      ) : books.data.items.length ? (
        <>
          <div className="book-grid">
            {books.data.items.map((book) => (
              <BookTile key={book._id} book={book} />
            ))}
          </div>
          <div className="pagination">
            <Button
              className="button secondary"
              disabled={books.data.page <= 1}
              onClick={() => update('page', String(books.data.page - 1))}
            >
              {t('catalog.previous')}
            </Button>
            <span>
              {t('catalog.page', { page: books.data.page, pages: Math.max(1, books.data.pages) })}
            </span>
            <Button
              className="button secondary"
              disabled={books.data.page >= books.data.pages}
              onClick={() => update('page', String(books.data.page + 1))}
            >
              {t('catalog.next')}
            </Button>
          </div>
        </>
      ) : (
        <Empty title={t('catalog.emptyTitle')}>
          <p className="muted">{t('catalog.emptyText')}</p>
          <Button
            className="button secondary"
            onClick={() => {
              setParams({})
              setInput('')
            }}
          >
            {t('catalog.clear')}
          </Button>
        </Empty>
      )}
    </div>
  )
}
