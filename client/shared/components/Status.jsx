import { useTranslation } from 'react-i18next'
const good = ['active', 'available', 'returned', 'fulfilled', 'ready', 'paid']
const bad = ['overdue', 'suspended', 'retired', 'damaged', 'lost', 'expired', 'outstanding']
export function Status({ value }) {
  const { t } = useTranslation()
  return (
    <span className={`status ${good.includes(value) ? 'good' : bad.includes(value) ? 'bad' : ''}`}>
      {t(`status.${value}`, { defaultValue: value.replaceAll('_', ' ') })}
    </span>
  )
}
