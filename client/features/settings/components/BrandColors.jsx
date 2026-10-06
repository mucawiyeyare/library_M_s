import { useTranslation } from 'react-i18next'
import { brandPalette, defaultColors } from '../../../shared/lib/brand-palette'
// The Garbaharey preset uses the logo's cyan and orange.
const presets = [
  { name: 'Garbaharey', primary: '#29c5e0', secondary: '#f47920' },
  { name: 'Forest', primary: '#24634b', secondary: '#7c6651' },
  { name: 'Ocean', primary: '#245b91', secondary: '#607487' },
  { name: 'Plum', primary: '#74518b', secondary: '#817060' },
  { name: 'Terracotta', primary: '#a14932', secondary: '#69714d' },
]
export default function BrandColors({ primary, secondary, onChange }) {
  const { t } = useTranslation()
  const p = primary ?? defaultColors.primaryColor,
    s = secondary ?? defaultColors.secondaryColor
  const selected =
    presets.find((item) => item.primary === p && item.secondary === s)?.name ?? 'Custom'
  return (
    <section className="brand-color-settings">
      <h2>{t('ui.brand.title')}</h2>
      <div className="brand-color-controls">
        <label>
          {t('ui.brand.preset')}
          <select
            value={selected}
            onChange={(event) => {
              const preset = presets.find((item) => item.name === event.target.value)
              if (preset) {
                onChange('primaryColor', preset.primary)
                onChange('secondaryColor', preset.secondary)
              }
            }}
          >
            {presets.map((item) => (
              <option key={item.name} value={item.name}>
                {t(`ui.brand.presets.${item.name}`)}
              </option>
            ))}
            <option value="Custom">{t('ui.brand.presets.Custom')}</option>
          </select>
        </label>
        <label>
          {t('ui.brand.primary')}
          <span className="brand-color-picker">
            <input
              type="color"
              aria-label={t('ui.brand.primary')}
              value={p}
              onChange={(event) => onChange('primaryColor', event.target.value)}
            />
            <code>{p}</code>
          </span>
        </label>
        <label>
          {t('ui.brand.secondary')}
          <span className="brand-color-picker">
            <input
              type="color"
              aria-label={t('ui.brand.secondary')}
              value={s}
              onChange={(event) => onChange('secondaryColor', event.target.value)}
            />
            <code>{s}</code>
          </span>
        </label>
      </div>
      <div className="brand-color-previews">
        {[false, true].map((dark) => (
          <div key={String(dark)} className="brand-color-preview" style={brandPalette(p, s, dark)}>
            <strong>{dark ? t('ui.brand.darkMode') : t('ui.brand.lightMode')}</strong>
            <p>{t('ui.brand.sample')}</p>
            <div className="brand-preview-actions">
              <span className="brand-preview-primary">{t('ui.brand.primaryAction')}</span>
              <span className="brand-preview-secondary">{t('ui.brand.secondaryAction')}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="muted">{t('ui.brand.note')}</p>
    </section>
  )
}
