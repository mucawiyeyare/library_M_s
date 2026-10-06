import { useAction } from '../../../shared/hooks/useAction'
import { BookCover } from '../components/BookCover'
import { Button } from '../../../shared/components/primitives/button'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bookmark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'
import { useAuth } from '../../auth/providers/AuthProvider'
import { ErrorState, Loading, MutationFeedback, Status } from '../../../shared/components/ui'
export function BookDetails() {
  const { t, i18n } = useTranslation()
  const { bookId } = useParams()
  const { user } = useAuth()
  const book = useQuery({
    queryKey: ['book', bookId, i18n.language],
    queryFn: () => api(`/books/${bookId}?lang=${i18n.language}`),
  })
  const saved = useQuery({
    queryKey: ['saved'],
    queryFn: () => api('/me/saved'),
    enabled: !!user,
  })
  const holds = useQuery({
    queryKey: ['reservations', 'mine'],
    queryFn: () => api('/reservations?scope=mine'),
    enabled: !!user,
  })
  const isSaved = saved.data?.some((item) => item._id === bookId),
    reserved = holds.data?.some((item) => item.book?._id === bookId && item.status === 'waiting')
  const save = useAction(`/me/saved/${bookId}`, isSaved ? 'DELETE' : 'PUT')
  const reserve = useAction('/reservations')
  if (book.isPending) return <Loading />
  if (book.error)
    return (
      <div className="container page">
        <ErrorState error={book.error} />
        <Link to="/catalog">{t('book.back')}</Link>
      </div>
    )
  return (
    <div className="container page">
      <Link className="text-link back-link" to="/catalog">
        <ArrowLeft size={17} />
        {t('book.back')}
      </Link>
      <div className="book-details">
        <BookCover book={book.data} large />
        <div>
          <p className="eyebrow">{book.data.categoryName ?? book.data.genre}</p>
          <h1>{book.data.title}</h1>
          <p className="book-author">{t('book.by', { author: book.data.author })}</p>
          <Status value={book.data.copies?.available ? 'available' : 'on_loan'} />
          <p className="book-description">{book.data.description || t('book.ask')}</p>
          <dl className="book-facts">
            <div>
              <dt>{t('book.published')}</dt>
              <dd>{book.data.year}</dd>
            </div>
            <div>
              <dt>{t('book.isbn')}</dt>
              <dd>{book.data.isbn}</dd>
            </div>
            <div>
              <dt>{t('book.copies')}</dt>
              <dd>
                {book.data.copies?.available ?? 0} of {book.data.copies?.total ?? 0}
              </dd>
            </div>
            {book.data.publisherName && (
              <div>
                <dt>{t('book.publisher')}</dt>
                <dd>{book.data.publisherName}</dd>
              </div>
            )}
            <div>
              <dt>{t('book.language')}</dt>
              <dd>{t(`catalog.languages.${book.data.language ?? 'en'}`)}</dd>
            </div>
            {book.data.edition && (
              <div>
                <dt>{t('book.edition')}</dt>
                <dd>{book.data.edition}</dd>
              </div>
            )}
          </dl>
          {user ? (
            <div className="button-row">
              <Button
                className="button"
                disabled={reserve.isPending || reserved}
                onClick={() => reserve.mutate({ bookId })}
              >
                {reserved
                  ? t('book.reserved')
                  : reserve.isPending
                    ? t('book.reserving')
                    : t('book.reserve')}
              </Button>
              <Button
                className="button secondary"
                disabled={save.isPending}
                onClick={() => save.mutate(undefined)}
              >
                <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} />
                {isSaved ? t('book.unsave') : t('book.save')}
              </Button>
            </div>
          ) : (
            <Link className="button" to="/login">
              {t('book.signInToReserve')}
            </Link>
          )}
          <MutationFeedback error={reserve.error || save.error} success={reserve.isSuccess} />
          <p className="muted detail-note">{t('book.queueNote')}</p>
          <h3>{t('book.where')}</h3>
          <div className="copy-locations">
            {book.data.inventory?.length ? (
              book.data.inventory.map((copy) => (
                <div key={copy._id}>
                  <span>{copy.shelf}</span>
                  <Status value={copy.status} />
                </div>
              ))
            ) : (
              <p className="muted">{t('book.noCopies')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
