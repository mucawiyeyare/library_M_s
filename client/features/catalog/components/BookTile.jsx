import { BookCover } from './BookCover'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
export function BookTile({ book }) {
  const { t } = useTranslation()
  return (
    <article className="book-tile">
      <Link to={`/book/${book._id}`} aria-label={book.title}>
        <BookCover book={book} />
      </Link>
      <div className="book-meta">
        <span className="eyebrow">{book.categoryName ?? book.genre}</span>
        <h3>
          <Link to={`/book/${book._id}`}>{book.title}</Link>
        </h3>
        <p className="muted">{book.author}</p>
        <div className="book-meta-bottom">
          <span className={`availability ${book.copies?.available ? 'available' : ''}`}>
            {book.copies?.available
              ? t('catalog.available', { count: book.copies.available })
              : t('catalog.none')}
          </span>
          <Link to={`/book/${book._id}`} aria-label={`${t('catalog.view')}: ${book.title}`}>
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  )
}
