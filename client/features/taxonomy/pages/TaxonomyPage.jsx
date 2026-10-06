import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, body } from '../../../shared/lib/api'
import { Empty, ErrorState, Loading, PageHeading } from '../../../shared/components/ui'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import '../../content/styles/content.css'

const langs = ['en', 'so', 'ar']
const blank = {
  categories: {
    name: { en: '', so: '', ar: '' },
    description: { en: '', so: '', ar: '' },
    status: 'active',
  },
  authors: { name: '', biography: '', country: '' },
  publishers: { name: '', contact: '' },
}
const label = (kind, item) =>
  kind === 'categories' ? item.name.en || item.name.so || item.name.ar : item.name

// One screen for categories (translatable), authors and publishers (plain records).
export default function TaxonomyPage({ kind }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const list = useQuery({
    queryKey: ['taxonomy', kind, search],
    queryFn: () => api(`/staff/${kind}?q=${encodeURIComponent(search)}`),
  })
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['taxonomy'] })
    void client.invalidateQueries({ queryKey: [`staff-${kind}-all`] })
    void client.invalidateQueries({ queryKey: ['staff-categories-all'] })
    void client.invalidateQueries({ queryKey: ['staff-publishers-all'] })
    void client.invalidateQueries({ queryKey: ['books'] })
  }
  const save = useMutation({
    mutationFn: (values) =>
      api(editing._id ? `/staff/${kind}/${editing._id}` : `/staff/${kind}`, {
        method: editing._id ? 'PUT' : 'POST',
        body: body(values),
      }),
    onError: (error) => toast.error(error.message, { id: error.message, duration: 7000 }),
    onSuccess: () => {
      toast.success(t('staffContent.saved'))
      setEditing(null)
      refresh()
    },
  })
  const archive = useMutation({
    mutationFn: (id) => api(`/staff/${kind}/${id}`, { method: 'DELETE' }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(t('staffContent.archived'))
      refresh()
    },
  })
  const set = (patch) => setEditing({ ...editing, ...patch })
  return (
    <>
      <PageHeading title={t(`taxonomy.${kind}.title`)} description={t(`taxonomy.${kind}.intro`)}>
        <Button onClick={() => setEditing({ ...blank[kind] })}>{t('staffContent.add')}</Button>
      </PageHeading>
      <div className="catalog-controls">
        <Input
          aria-label={t('taxonomy.search')}
          placeholder={t('taxonomy.search')}
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {editing && (
        <form
          className="panel form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(editing)
          }}
        >
          {kind === 'categories' ? (
            <>
              {langs.map((lng) => (
                <fieldset key={lng} lang={lng} dir={lng === 'ar' ? 'rtl' : 'ltr'}>
                  <legend>{t(`language.${lng}`)}</legend>
                  <label>
                    {t('taxonomy.name')}
                    <Input
                      value={editing.name[lng] ?? ''}
                      maxLength={100}
                      onChange={(e) => set({ name: { ...editing.name, [lng]: e.target.value } })}
                    />
                  </label>
                  <label>
                    {t('taxonomy.description')}
                    <textarea
                      rows={2}
                      value={editing.description?.[lng] ?? ''}
                      maxLength={1000}
                      onChange={(e) =>
                        set({ description: { ...editing.description, [lng]: e.target.value } })
                      }
                    />
                  </label>
                </fieldset>
              ))}
              <label>
                {t('taxonomy.status')}
                <select value={editing.status} onChange={(e) => set({ status: e.target.value })}>
                  <option value="active">{t('taxonomy.active')}</option>
                  <option value="inactive">{t('taxonomy.inactive')}</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                {t('taxonomy.name')}
                <Input
                  required
                  value={editing.name}
                  maxLength={150}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </label>
              {kind === 'authors' ? (
                <>
                  <label>
                    {t('taxonomy.country')}
                    <Input
                      value={editing.country ?? ''}
                      maxLength={80}
                      onChange={(e) => set({ country: e.target.value })}
                    />
                  </label>
                  <label>
                    {t('taxonomy.biography')}
                    <textarea
                      rows={3}
                      value={editing.biography ?? ''}
                      maxLength={3000}
                      onChange={(e) => set({ biography: e.target.value })}
                    />
                  </label>
                </>
              ) : (
                <label>
                  {t('taxonomy.contact')}
                  <Input
                    value={editing.contact ?? ''}
                    maxLength={300}
                    onChange={(e) => set({ contact: e.target.value })}
                  />
                </label>
              )}
            </>
          )}
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
                <strong>{label(kind, item)}</strong>
                <div className="muted">
                  {t('taxonomy.books')}: {item.bookCount}
                  {item.country ? ` · ${item.country}` : ''}
                </div>
              </div>
              <div className="button-row">
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditing(
                      kind === 'categories'
                        ? {
                            ...item,
                            name: { ...blank.categories.name, ...item.name },
                            description: { ...blank.categories.description, ...item.description },
                          }
                        : item,
                    )
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
