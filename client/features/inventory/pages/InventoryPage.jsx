import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import Pagination from '../../../shared/components/Pagination'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import {
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
  Status,
} from '../../../shared/components/ui'
import BookForm from '../components/BookForm'
import CopyManager from '../components/CopyManager'
export default function InventoryPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const [copies, setCopies] = useState(null)
  const books = usePagedList('inventory', '/staff/books', `q=${encodeURIComponent(search)}`)
  const filtered = books.data
  return (
    <>
      <PageHeading
        eyebrow={t('ui.inventory.eyebrow')}
        title={t('ui.inventory.title')}
        description={t('ui.inventory.intro')}
      >
        <Button className="button" onClick={() => setEditor('new')}>
          <Plus size={18} />
          {t('ui.inventory.addTitle')}
        </Button>
      </PageHeading>
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={18} />
            <Input
              aria-label={t('ui.inventory.search')}
              placeholder={t('ui.inventory.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <span className="muted">{t('ui.inventory.count', { count: books.total })}</span>
        </div>
        {books.isPending ? (
          <Loading />
        ) : books.error ? (
          <ErrorState error={books.error} />
        ) : filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('ui.inventory.titleAuthor')}</th>
                  <th>{t('book.isbn')}</th>
                  <th>{t('catalog.category')}</th>
                  <th>{t('catalog.year')}</th>
                  <th>{t('member.status')}</th>
                  <th>{t('member.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((book) => (
                  <tr key={book._id}>
                    <td>
                      <strong>{book.title}</strong>
                      <small>{book.author}</small>
                    </td>
                    <td className="mono">{book.isbn}</td>
                    <td>{book.categoryName ?? book.genre}</td>
                    <td>{book.year}</td>
                    <td>
                      <Status value={book.archived ? 'archived' : 'active'} />
                    </td>
                    <td>
                      <div className="button-row">
                        <Button className="button secondary small" onClick={() => setEditor(book)}>
                          {t('staffContent.edit')}
                        </Button>
                        <Button className="button secondary small" onClick={() => setCopies(book)}>
                          {t('ui.inventory.copies')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={search ? t('ui.inventory.noMatch') : t('ui.inventory.empty')}>
            <p className="muted">{t('ui.inventory.emptyHint')}</p>
          </Empty>
        )}
        <Pagination
          page={books.page}
          pages={books.pages}
          total={books.total}
          setPage={books.setPage}
        />
      </section>
      <Modal
        title={editor === 'new' ? t('ui.inventory.addTitleDialog') : t('ui.inventory.editTitle')}
        description={t('ui.inventory.dialogIntro')}
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      >
        {editor && (
          <BookForm
            key={editor === 'new' ? 'new' : editor._id}
            book={editor === 'new' ? undefined : editor}
            onSaved={() => setEditor(null)}
          />
        )}
      </Modal>
      <Modal
        title={t('ui.inventory.copiesOf', { title: copies?.title ?? '' })}
        description={t('ui.inventory.copiesIntro')}
        open={!!copies}
        onOpenChange={(open) => {
          if (!open) setCopies(null)
        }}
      >
        {copies && <CopyManager book={copies} />}
      </Modal>
    </>
  )
}
