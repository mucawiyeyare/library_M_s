import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'
import { useAction } from '../../../shared/hooks/useAction'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { bookSchema } from '../../../../server/contracts/schemas'
import { MutationFeedback } from '../../../shared/components/ui'
export default function BookForm({ book, onSaved }) {
  const { t } = useTranslation()
  const categories = useQuery({
    queryKey: ['staff-categories-all'],
    queryFn: () => api('/staff/categories'),
  })
  const publishers = useQuery({
    queryKey: ['staff-publishers-all'],
    queryFn: () => api('/staff/publishers'),
  })
  const [coverFile, setCoverFile] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const form = useForm({
    resolver: zodResolver(bookSchema),
    defaultValues: book
      ? {
          ...book,
          category: book.category ?? '',
          publisher: book.publisher ?? '',
          language: book.language ?? 'en',
          edition: book.edition ?? '',
          featured: book.featured ?? false,
        }
      : {
          title: '',
          author: '',
          isbn: '',
          category: '',
          publisher: '',
          language: 'en',
          edition: '',
          year: new Date().getFullYear(),
          description: '',
          archived: false,
          featured: false,
        },
  })
  const action = useAction(
    book ? `/staff/books/${book._id}` : '/staff/books',
    book ? 'PATCH' : 'POST',
    onSaved,
  )
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit(
        async (values) => {
          setUploadError(null)
          setUploading(true)
          try {
            if (coverFile) {
              const uploaded = await api('/staff/covers', {
                method: 'POST',
                body: coverFile,
                headers: { 'Content-Type': coverFile.type },
              })
              values.coverId = uploaded.coverId
            }
            action.mutate(values)
          } catch (error) {
            setUploadError(error)
          } finally {
            setUploading(false)
          }
        },
        // Never fail silently: show the first problem, even for fields without an inline message.
        (errors) => toast.error(Object.values(errors)[0]?.message ?? t('ui.common.checkForm')),
      )}
    >
      <div className="form-grid">
        {[
          { key: 'title', label: t('reports.cols.title'), placeholder: t('bookForm.titleHint') },
          { key: 'author', label: t('bookForm.authors'), placeholder: t('bookForm.authorsHint') },
          {
            key: 'isbn',
            label: t('bookForm.isbn'),
            placeholder: 'e.g. 9780385474542 / CAT-0001',
          },
          { key: 'year', label: t('bookForm.year'), placeholder: '2024' },
          { key: 'edition', label: t('bookForm.edition'), placeholder: '' },
        ].map(({ key, label, placeholder }) => (
          <label key={key}>
            {label}
            <Input
              placeholder={placeholder}
              type={key === 'year' ? 'number' : 'text'}
              {...form.register(key)}
            />
            {form.formState.errors[key] && (
              <span className="form-error">{form.formState.errors[key]?.message}</span>
            )}
          </label>
        ))}
        <label>
          {t('bookForm.category')}
          <select {...form.register('category')}>
            <option value="">{t('bookForm.chooseCategory')}</option>
            {categories.data?.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name.en || category.name.so || category.name.ar}
              </option>
            ))}
          </select>
          {form.formState.errors.category && (
            <span className="form-error">{form.formState.errors.category.message}</span>
          )}
        </label>
        <label>
          {t('bookForm.publisher')}
          <select {...form.register('publisher')}>
            <option value="">{t('bookForm.noPublisher')}</option>
            {publishers.data?.map((publisher) => (
              <option key={publisher._id} value={publisher._id}>
                {publisher.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('bookForm.language')}
          <select {...form.register('language')}>
            {['en', 'so', 'ar', 'other'].map((language) => (
              <option key={language} value={language}>
                {t(`catalog.languages.${language}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {t('bookForm.cover')}
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            if (
              file &&
              (file.size > 5 * 1024 * 1024 ||
                !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
            ) {
              setUploadError(new Error(t('bookForm.coverInvalid')))
              event.target.value = ''
              setCoverFile(null)
            } else {
              setUploadError(null)
              setCoverFile(file)
            }
          }}
        />
        <small className="muted">{t('bookForm.coverHint')}</small>
      </label>
      {form.watch('coverId') && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.setValue('coverId', null)
            setCoverFile(null)
          }}
        >
          {t('bookForm.plainCover')}
        </Button>
      )}
      <label>
        {t('taxonomy.description')}
        <textarea
          placeholder={t('bookForm.descriptionHint')}
          rows={4}
          {...form.register('description')}
        />
      </label>
      <label className="checkbox-label">
        <Input type="checkbox" {...form.register('featured')} />
        {t('bookForm.featured')}
      </label>
      {book && (
        <label className="checkbox-label">
          <Input type="checkbox" {...form.register('archived')} />
          {t('bookForm.archive')}
        </label>
      )}
      <MutationFeedback error={uploadError ?? action.error} />
      <Button className="button" disabled={action.isPending || uploading}>
        {action.isPending || uploading
          ? t('staffContent.saving')
          : book
            ? t('bookForm.saveChanges')
            : t('ui.inventory.addTitle')}
      </Button>
    </form>
  )
}
