import i18n from '../../i18n'
// Dates follow the selected language; the library runs on East Africa Time.
export function formatDate(value) {
  return new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : i18n.language, {
    dateStyle: 'medium',
    timeZone: 'Africa/Mogadishu',
  }).format(new Date(value))
}
