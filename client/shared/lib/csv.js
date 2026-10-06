export function csvDownload(name, headers, rows) {
  const quote = (value) => {
    const raw = String(value ?? '')
    return `"${(/^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw).replaceAll('"', '""')}"`
  }
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + [headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
