import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { toast } from 'sonner'
import { ImagePlus } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { api } from '../../../shared/lib/api'
import { useAction } from '../../../shared/hooks/useAction'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { Loading, ErrorState, PageHeading } from '../../../shared/components/ui'
import BrandColors from '../components/BrandColors'
import { defaultColors } from '../../../shared/lib/brand-palette'
function SettingsForm({ settings }) {
  const { t } = useTranslation()
  const form = useForm({ defaultValues: { ...defaultColors, ...settings } })
  const action = useAction('/staff/settings', 'PUT')
  const logoInput = useRef(null)
  const logoId = useWatch({ control: form.control, name: 'logoId' })
  const primary = useWatch({ control: form.control, name: 'primaryColor' })
  const secondary = useWatch({ control: form.control, name: 'secondaryColor' })
  const upload = useMutation({
    mutationFn: (file) =>
      api('/staff/settings/logo', {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type },
      }),
    onSuccess: (data) => {
      form.setValue('logoId', data.logoId)
      toast.success(t('ui.settings.logoReady'))
    },
    onError: (error) => toast.error(error.message),
  })
  return (
    <form
      className="form-stack panel settings-form"
      onSubmit={form.handleSubmit((values) => action.mutate(values))}
    >
      <div className="branding-controls">
        {logoId && (
          <img
            className="business-logo-preview"
            src={`/api/covers/${logoId}`}
            alt={t('ui.settings.logoPreview')}
          />
        )}
        <input
          hidden
          type="file"
          ref={logoInput}
          aria-label={t('ui.settings.logoFile')}
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              if (
                !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
                file.size > 5 * 1024 * 1024
              )
                toast.error(t('ui.settings.logoInvalid'))
              else upload.mutate(file)
            }
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={upload.isPending}
          onClick={() => logoInput.current?.click()}
        >
          <ImagePlus size={18} />
          {upload.isPending
            ? t('ui.settings.uploading')
            : logoId
              ? t('ui.settings.changeLogo')
              : t('ui.settings.uploadLogo')}
        </Button>
        {logoId && (
          <Button type="button" variant="ghost" onClick={() => form.setValue('logoId', null)}>
            {t('ui.settings.removeLogo')}
          </Button>
        )}
        <label className="checkbox-label">
          <Input
            type="checkbox"
            {...form.register('showName')}
            defaultChecked={settings.showName !== false}
          />
          {t('ui.settings.showName')}
        </label>
      </div>
      <BrandColors
        primary={primary}
        secondary={secondary}
        onChange={(key, value) => form.setValue(key, value)}
      />
      <div className="form-grid">
        {[
          { key: 'name', label: t('ui.settings.name'), hint: t('ui.settings.nameHint') },
          { key: 'email', label: t('ui.settings.email'), hint: 'library@example.com' },
          { key: 'phone', label: t('ui.settings.phone'), hint: '+252 ...' },
          { key: 'address', label: t('home.address'), hint: t('ui.settings.addressHint') },
          { key: 'hours', label: t('home.hours'), hint: t('ui.settings.hoursHint') },
          { key: 'timezone', label: t('ui.settings.timezone'), hint: 'Africa/Mogadishu' },
        ].map((field) => (
          <label key={field.key}>
            {field.label}
            <Input
              placeholder={field.hint}
              type={field.key === 'email' ? 'email' : 'text'}
              required={['name', 'timezone'].includes(field.key)}
              {...form.register(field.key)}
            />
          </label>
        ))}
      </div>
      <label className="checkbox-label">
        <Input type="checkbox" {...form.register('emailEnabled')} />
        {t('ui.settings.emailEnabled')}
      </label>
      <label>
        {t('ui.settings.reminderDays')}
        <Input
          type="number"
          min={0}
          max={14}
          placeholder="e.g. 2"
          {...form.register('reminderDays', { valueAsNumber: true })}
        />
      </label>
      <Button disabled={action.isPending || upload.isPending}>
        {action.isPending ? t('staffContent.saving') : t('ui.settings.save')}
      </Button>
    </form>
  )
}
export default function LibrarySettingsPage() {
  const { t } = useTranslation()
  const settings = useQuery({
    queryKey: ['admin-library-settings'],
    queryFn: () => api('/staff/settings'),
  })
  return (
    <>
      <PageHeading
        eyebrow={t('ui.settings.eyebrow')}
        title={t('nav.settings')}
        description={t('ui.settings.intro')}
      />
      {settings.isPending ? (
        <Loading />
      ) : settings.error ? (
        <ErrorState error={settings.error} />
      ) : (
        <SettingsForm settings={settings.data} />
      )}
    </>
  )
}
