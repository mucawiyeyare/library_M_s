import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, body } from '../../../shared/lib/api'
import { Empty, ErrorState, Loading, PageHeading } from '../../../shared/components/ui'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { useAuth } from '../../auth/providers/AuthProvider'
import '../styles/content.css'

const langs = ['en', 'so', 'ar']
const blank = (kind) => ({
  kind,
  title: { en: '', so: '', ar: '' },
  body: { en: '', so: '', ar: '' },
  eventDate: '',
  featured: false,
  published: true,
  order: 0,
})

export default function ContentManagerPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const client = useQueryClient()
  // Librarians manage news and events; administrators manage everything.
  const kinds =
    user?.role === 'admin'
      ? ['service', 'joininfo', 'rule', 'about', 'news', 'event']
      : ['news', 'event']
  const [kind, setKind] = useState(kinds[0])
  const [editing, setEditing] = useState(null)
  const list = useQuery({
    queryKey: ['staff-content', kind],
    queryFn: () => api(`/staff/content?kind=${kind}`),
  })
  const save = useMutation({
    mutationFn: (values) =>
      api(editing._id ? `/staff/content/${editing._id}` : '/staff/content', {
        method: editing._id ? 'PUT' : 'POST',
        body: body({ ...values, eventDate: values.eventDate || null }),
      }),
    onError: (error) => toast.error(error.message, { id: error.message, duration: 7000 }),
    onSuccess: () => {
      toast.success(t('staffContent.saved'))
      setEditing(null)
      void client.invalidateQueries({ queryKey: ['staff-content'] })
      void client.invalidateQueries({ queryKey: ['public-content'] })
    },
  })
  const archive = useMutation({
    mutationFn: (id) => api(`/staff/content/${id}`, { method: 'DELETE' }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(t('staffContent.archived'))
      void client.invalidateQueries({ queryKey: ['staff-content'] })
      void client.invalidateQueries({ queryKey: ['public-content'] })
    },
  })
  const set = (patch) => setEditing({ ...editing, ...patch })
  return (
    <>
      <PageHeading title={t('staffContent.title')} description={t('staffContent.intro')}>
        <Button onClick={() => setEditing(blank(kind))}>{t('staffContent.add')}</Button>
      </PageHeading>
      <div className="segmented content-tabs" role="group" aria-label={t('staffContent.title')}>
        {kinds.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value)
              setEditing(null)
            }}
          >
            {t(`staffContent.kinds.${value}`)}
          </button>
        ))}
      </div>
      {editing && (
        <form
          className="panel form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(editing)
          }}
        >
          {langs.map((lng) => (
            <fieldset key={lng} lang={lng} dir={lng === 'ar' ? 'rtl' : 'ltr'}>
              <legend>{t(`language.${lng}`)}</legend>
              <label>
                {t('staffContent.titleField')}
                <Input
                  value={editing.title[lng]}
                  maxLength={200}
                  onChange={(e) => set({ title: { ...editing.title, [lng]: e.target.value } })}
                />
              </label>
              <label>
                {t('staffContent.bodyField')}
                <textarea
                  rows={4}
                  value={editing.body[lng]}
                  maxLength={8000}
                  onChange={(e) => set({ body: { ...editing.body, [lng]: e.target.value } })}
                />
              </label>
            </fieldset>
          ))}
          <div className="form-grid">
            {kind === 'event' && (
              <label>
                {t('staffContent.date')}
                <Input
                  type="date"
                  value={editing.eventDate ? String(editing.eventDate).slice(0, 10) : ''}
                  onChange={(e) => set({ eventDate: e.target.value })}
                />
              </label>
            )}
            <label>
              {t('staffContent.order')}
              <Input
                type="number"
                min={0}
                value={editing.order}
                onChange={(e) => set({ order: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editing.featured}
              onChange={(e) => set({ featured: e.target.checked })}
            />
            {t('staffContent.featured')}
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editing.published}
              onChange={(e) => set({ published: e.target.checked })}
            />
            {t('staffContent.published')}
          </label>
          <div className="button-row">
            <Button disabled={save.isPending}>
              {save.isPending ? t('staffContent.saving') : t('staffContent.save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              {t('staffContent.cancel')}
            </Button>
          </div>
        </form>
      )}
      <section className="panel staff-content-list">
        {list.isPending ? (
          <Loading />
        ) : list.error ? (
          <ErrorState error={list.error} retry={() => void list.refetch()} />
        ) : list.data.length ? (
          list.data.map((item) => (
            <article key={item._id}>
              <div>
                <strong>{item.title.en || item.title.so || item.title.ar}</strong>
                <div>
                  {item.missing.length ? (
                    <span className="missing-badge">
                      {t('staffContent.missing')}:{' '}
                      {item.missing.map((l) => l.toUpperCase()).join(', ')}
                    </span>
                  ) : (
                    <span className="muted">{t('staffContent.complete')}</span>
                  )}
                </div>
              </div>
              <div className="button-row">
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditing({
                      ...blank(kind),
                      ...item,
                      title: { ...blank(kind).title, ...item.title },
                      body: { ...blank(kind).body, ...item.body },
                    })
                  }
                >
                  {t('staffContent.edit')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(t('staffContent.confirmArchive'))) archive.mutate(item._id)
                  }}
                >
                  {t('staffContent.archive')}
                </Button>
              </div>
            </article>
          ))
        ) : (
          <Empty title={t('staffContent.none')} />
        )}
      </section>
    </>
  )
}
