import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { downloadReport } from '../../../shared/lib/download'

const statusesFor = {
  inventory: ['all', 'available', 'on_loan', 'retired'],
  reservations: ['all', 'waiting', 'fulfilled', 'cancelled'],
  overdue: ['all'],
  loans: ['all', 'active', 'returned', 'overdue'],
}

// Record-level CSV exports (every loan, reservation or copy), straight from the server.
export default function ExportPanel() {
  const { t } = useTranslation()
  const [kind, setKind] = useState('loans')
  const [status, setStatus] = useState('all')
  const [dateField, setDateField] = useState('createdAt')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <section className="panel report-export-panel">
      <div className="section-heading">
        <div>
          <h2>{t('ui.export.title')}</h2>
          <p className="muted">{t('ui.export.intro')}</p>
        </div>
      </div>
      <form
        className="form-stack export-fields"
        onSubmit={(event) => {
          event.preventDefault()
          if (from && to && from > to) {
            toast.error(t('reports.badRange'))
            return
          }
          const params = new URLSearchParams({
            status,
            dateField,
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(q ? { q } : {}),
          })
          setBusy(true)
          void downloadReport(`/staff/reports/${kind}.csv?${params}`, `${kind}-report.csv`)
            .then(() => toast.success(t('reports.exported')))
            .catch((error) => toast.error(error.message))
            .finally(() => setBusy(false))
        }}
      >
        <label>
          {t('reports.report')}
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value)
              setStatus('all')
              setDateField('createdAt')
            }}
          >
            {['loans', 'overdue', 'reservations', 'inventory'].map((value) => (
              <option key={value} value={value}>
                {t(`ui.export.kinds.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('member.status')}
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusesFor[kind].map((item) => (
              <option key={item} value={item}>
                {item === 'all'
                  ? t('ui.export.all')
                  : item === 'active'
                    ? t('ui.circ.tab.active')
                    : t(`status.${item === 'waiting' ? 'pending' : item}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('ui.export.dateApplies')}
          <select value={dateField} onChange={(event) => setDateField(event.target.value)}>
            <option value="createdAt">
              {kind === 'inventory'
                ? t('ui.export.copyAdded')
                : kind === 'reservations'
                  ? t('ui.export.requested')
                  : t('ui.export.issued')}
            </option>
            {['loans', 'overdue'].includes(kind) && (
              <>
                <option value="dueAt">{t('member.due')}</option>
                <option value="returnedAt">{t('member.returnedOn')}</option>
              </>
            )}
          </select>
        </label>
        <label>
          {t('reports.from')}
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            max={to || undefined}
          />
        </label>
        <label>
          {t('reports.to')}
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            min={from || undefined}
          />
        </label>
        <label>
          {t('reports.search')}
          <Input
            placeholder={
              kind === 'inventory' ? t('ui.export.searchCopies') : t('ui.export.searchLoans')
            }
            maxLength={100}
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
        <Button disabled={busy}>
          <Download size={17} aria-hidden="true" />
          {busy ? t('ui.export.exporting') : t('ui.export.button')}
        </Button>
      </form>
    </section>
  )
}
