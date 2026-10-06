import { useTranslation } from 'react-i18next'
import { useState } from 'react'
export function BookCover({ book, large = false }) {
  const { t } = useTranslation()
  const [failedCover, setFailedCover] = useState(null)
  if (book.coverId && failedCover !== book.coverId)
    return (
      <div className={`book-cover uploaded-cover ${large ? 'large' : ''}`}>
        <img
          src={`/api/covers/${book.coverId}`}
          alt={t('ui.common.coverOf', { title: book.title })}
          loading="lazy"
          onError={() => setFailedCover(book.coverId)}
        />
      </div>
    )
  const variants = ['forest', 'sand', 'blue', 'rust']
  const index = [...book.title].reduce((sum, char) => sum + char.charCodeAt(0), 0) % variants.length
  return (
    <div className={`book-cover ${variants[index]} ${large ? 'large' : ''}`}>
      <span className="cover-author">{book.author}</span>
      <strong>{book.title}</strong>
      <span className="cover-bottom">
        {book.categoryName ?? book.genre}
        <span>{t('ui.common.libraryCollection')}</span>
      </span>
    </div>
  )
}
