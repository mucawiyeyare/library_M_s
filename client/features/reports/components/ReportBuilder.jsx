import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download, Printer } from 'lucide-react'
import { api } from '../../../shared/lib/api'
import { csvDownload } from '../../../shared/lib/csv'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import Pagination from '../../../shared/components/Pagination'
import { Empty, ErrorState, Loading } from '../../../shared/components/ui'

// Which controls each report supports: date range, member search, grouping periods.
const groups = {
  books: {
    'books-by-category': {},
    'books-by-author': {},
    'books-by-publisher': {},
    inventory: {},
    'lost-damaged': { dates: true },
  },
  members: {
    'members-summary': {},
    'membership-growth': { dates: true, groupBy: ['month', 'day'] },
    'member-history': { dates: true, search: true },
  },
  borrowing: {
    'borrowing-by-period': { dates: true, groupBy: ['month', 'week', 'day'] },
    overdue: { dates: true },
    'most-borrowed': { dates: true },
    'popular-categories': { dates: true },
    'reservations-summary': { dates: true },
  },
  financial: {
    fines: { dates: true, search: true },
  },
}
const dateColumns = ['date', 'issued', 'due', 'returned']
const moneyColumns = ['amount', 'paid', 'fineSoFar']

export default function ReportBuilder() {
  const { t, i18n } = useTranslation()
  const [group, setGroup] = useState('borrowing')
  const [type, setType] = useState('borrowing-by-period')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [groupBy, setGroupBy] = useState('month')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const options = groups[group][type] ?? {}
  const invalidRange = from && to && from > to
  const params = new URLSearchParams({
    lang: i18n.language,
    groupBy: options.groupBy?.includes(groupBy) ? groupBy : (options.groupBy?.[0] ?? 'month'),
    ...(options.dates && from ? { from } : {}),
    ...(options.dates && to ? { to } : {}),
    ...(options.search && q ? { q } : {}),
  })
  const report = useQuery({
    queryKey: ['report-run', type, params.toString(), page],
    queryFn: () => api(`/staff/reports/run/${type}?${params}&page=${page}&limit=25`),
    enabled: !invalidRange,
  })

  const date = (value) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
          new Date(value),
        )
      : '—'
  const cell = (column, value) => {
    if (value === null || value === undefined || value === '')
      return column === 'returned' ? '—' : t('reports.none')
    if (dateColumns.includes(column)) return date(value)
    if (column === 'status')
      return t(`status.${value}`, { defaultValue: String(value).replaceAll('_', ' ') })
    if (column === 'metric') return t(`reports.metrics.${value}`)
    if (moneyColumns.includes(column)) return Number(value).toFixed(2)
    if (typeof value === 'number') return value.toLocaleString(i18n.language)
    return value
  }
  const plain = (column, value) => {
    if (dateColumns.includes(column)) return value ? new Date(value).toISOString().slice(0, 10) : ''
    if (column === 'status') return t(`status.${value}`, { defaultValue: String(value ?? '') })
    if (column === 'metric') return t(`reports.metrics.${value}`)
    return value ?? ''
  }
  const reset = () => setPage(1)
  const exportCsv = async () => {
    setBusy(true)
    try {
      const all = await api(`/staff/reports/run/${type}?${params}&all=true`)
      csvDownload(
        `${type}-report.csv`,
        all.columns.map((column) => t(`reports.cols.${column}`)),
        all.rows.map((row) => all.columns.map((column) => plain(column, row[column]))),
      )
      toast.success(t('reports.exported'))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }
  const rangeText = [from && `${t('reports.from')} ${from}`, to && `${t('reports.to')} ${to}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="panel report-builder">
      <div className="section-heading compact no-print">
        <div>
          <h2>{t('reports.builder')}</h2>
          <p className="muted">{t('reports.builderIntro')}</p>
        </div>
      </div>
      <form
        className="form-stack export-fields no-print"
        onSubmit={(event) => event.preventDefault()}
      >
        <label>
          {t('reports.group')}
          <select
            value={group}
            onChange={(event) => {
              const next = event.target.value
              setGroup(next)
              setType(Object.keys(groups[next])[0])
              reset()
            }}
          >
            {Object.keys(groups).map((key) => (
              <option key={key} value={key}>
                {t(`reports.groups.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('reports.report')}
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value)
              reset()
            }}
          >
            {Object.keys(groups[group]).map((key) => (
              <option key={key} value={key}>
                {t(`reports.types.${key}`)}
              </option>
            ))}
          </select>
        </label>
        {options.dates && (
          <>
            <label>
              {t('reports.from')}
              <Input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => {
                  setFrom(event.target.value)
                  reset()
                }}
              />
            </label>
            <label>
              {t('reports.to')}
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => {
                  setTo(event.target.value)
                  reset()
                }}
              />
            </label>
          </>
        )}
        {options.groupBy && (
          <label>
            {t('reports.groupBy')}
            <select
              value={options.groupBy.includes(groupBy) ? groupBy : options.groupBy[0]}
              onChange={(event) => {
                setGroupBy(event.target.value)
                reset()
              }}
            >
              {options.groupBy.map((key) => (
                <option key={key} value={key}>
                  {t(`reports.by.${key}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        {options.search && (
          <label>
            {t('reports.search')}
            <Input
              value={q}
              maxLength={100}
              placeholder={t('reports.searchPlaceholder')}
              onChange={(event) => {
                setQ(event.target.value)
                reset()
              }}
            />
          </label>
        )}
        <div className="button-row">
          <Button type="button" disabled={busy || !!invalidRange} onClick={() => void exportCsv()}>
            <Download size={17} />
            {t('reports.exportCsv')}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer size={17} />
            {t('reports.print')}
          </Button>
        </div>
        {invalidRange && <span className="form-error">{t('reports.badRange')}</span>}
      </form>

      <div className="print-only">
        <h2>{t(`reports.types.${type}`)}</h2>
        {rangeText && <p>{rangeText}</p>}
        <p>{new Date().toLocaleString(i18n.language)}</p>
      </div>
      {report.isPending && !invalidRange ? (
        <Loading />
      ) : report.error ? (
        <ErrorState error={report.error} retry={() => void report.refetch()} />
      ) : report.data ? (
        <>
          {report.data.summary.length > 0 && (
            <div className="metrics-grid">
              {report.data.summary.map((item) => (
                <div className="metric" key={item.key}>
                  <div>
                    <span>{t(`reports.summary.${item.key}`)}</span>
                  </div>
                  <strong>{item.value.toFixed(2)}</strong>
                </div>
              ))}
            </div>
          )}
          {report.data.rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {report.data.columns.map((column) => (
                      <th key={column}>{t(`reports.cols.${column}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.data.rows.map((row, index) => (
                    <tr key={index}>
                      {report.data.columns.map((column) => (
                        <td key={column}>{cell(column, row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title={t('reports.empty')} />
          )}
          <div className="no-print">
            <Pagination
              page={report.data.page}
              pages={report.data.pages}
              total={report.data.total}
              setPage={setPage}
            />
          </div>
        </>
      ) : null}
    </section>
  )
}
