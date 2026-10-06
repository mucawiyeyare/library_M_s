import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { useReport } from '../hooks/useReport'
import { formatDate } from '../../../shared/lib/date'
import { Empty } from '../../../shared/components/ui'

export function MetricTiles({ tiles }) {
  const { i18n } = useTranslation()
  return (
    <div className="metrics-grid">
      {tiles.map(({ title, value, sub, icon: Icon, money }) => (
        <div className="metric" key={title}>
          <div>
            <span>{title}</span>
            {Icon && <Icon size={19} aria-hidden="true" />}
          </div>
          <strong>
            {money ? Number(value ?? 0).toFixed(2) : (value ?? 0).toLocaleString(i18n.language)}
          </strong>
          {sub && <small>{sub}</small>}
        </div>
      ))}
    </div>
  )
}

// A ranked list with proportional bars (most borrowed, popular categories, growth).
export function BarList({ title, rows, unit, empty }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.length ? (
        <ol className="popular-list">
          {rows.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <progress value={row.value} max={max} aria-label={`${row.label}: ${row.value}`} />
              <small className="muted">
                {row.value} {unit}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title={empty} />
      )}
    </section>
  )
}

export function TrendPanels() {
  const { t } = useTranslation()
  const categories = useReport('popular-categories')
  const growth = useReport('membership-growth')
  return (
    <div className="dashboard-grid">
      <BarList
        title={t('ui.dash.popularCategories')}
        unit={t('director.loans')}
        empty={t('director.none')}
        rows={(categories.data?.rows ?? []).slice(0, 8).map((row) => ({
          label: row.category ?? t('reports.none'),
          value: row.loans,
        }))}
      />
      <BarList
        title={t('ui.dash.membershipGrowth')}
        unit={t('ui.dash.newMembers')}
        empty={t('director.none')}
        rows={(growth.data?.rows ?? []).slice(-12).map((row) => ({
          label: row.period,
          value: row.newMembers,
        }))}
      />
    </div>
  )
}

export function OverdueTable({ data }) {
  const { t } = useTranslation()
  return data.overdueTotal ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t('member.book')}</th>
            <th>{t('ui.issue.member')}</th>
            <th>{t('member.due')}</th>
          </tr>
        </thead>
        <tbody>
          {data.overdue.slice(0, 8).map((loan) => (
            <tr key={loan._id}>
              <td className="table-title">{loan.book?.title}</td>
              <td>{loan.member?.name}</td>
              <td className="danger-text">{formatDate(loan.dueAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title={t('ui.dash.nothingOverdue')}>
      <p className="muted">{t('ui.dash.onTime')}</p>
    </Empty>
  )
}

export function QuickLinks({ links }) {
  return (
    <div className="quick-actions">
      {links.map(([to, Icon, title, text]) => (
        <Link key={to} to={to}>
          <Icon size={21} aria-hidden="true" />
          <div>
            <strong>{title}</strong>
            <small>{text}</small>
          </div>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      ))}
    </div>
  )
}
