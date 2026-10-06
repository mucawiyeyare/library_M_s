import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ArrowRightLeft, BarChart3, BookOpen, ClipboardList, Users } from 'lucide-react'
import { api } from '../../../shared/lib/api'
import { Empty, ErrorState, Loading, PageHeading } from '../../../shared/components/ui'
import { useAuth } from '../../auth/providers/AuthProvider'
import OverviewCharts from '../components/OverviewCharts'
import { TrendPanels } from '../components/DashboardParts'

const copiesIn = (data, status) => data.inventory.find((item) => item._id === status)?.count ?? 0

// Read-only management view: totals, borrowing trends, popular titles and recent activity.
export default function DirectorDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const report = useQuery({ queryKey: ['reports'], queryFn: () => api('/staff/reports') })
  if (report.isPending) return <Loading />
  if (report.error) return <ErrorState error={report.error} retry={() => void report.refetch()} />
  const data = report.data
  const totalMembers = data.membership
    .filter((item) => item._id.role === 'member')
    .reduce((sum, item) => sum + item.count, 0)
  const date = (value) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value))
  const tiles = [
    ['titles', data.titles, BookOpen, t('director.copies', { count: data.copies })],
    ['available', copiesIn(data, 'available'), BookOpen],
    ['borrowed', copiesIn(data, 'on_loan'), ArrowRightLeft],
    ['overdue', data.overdueTotal, ArrowRightLeft],
    ['members', totalMembers, Users],
    ['active', data.members, Users],
    ['reservations', data.waiting, ClipboardList],
    ['applications', data.pendingApplications, ClipboardList],
  ]
  const maxLoans = Math.max(1, ...data.popularTitles.map((item) => item.loans))
  return (
    <>
      <PageHeading
        eyebrow={t('director.eyebrow')}
        title={t('director.hello', { name: user?.name.split(' ')[0] })}
        description={t('director.intro')}
      >
        <Link className="button" to="/staff/reports">
          <BarChart3 size={18} />
          {t('director.reports')}
        </Link>
      </PageHeading>
      <div className="metrics-grid">
        {tiles.map(([key, value, Icon, sub]) => (
          <div className="metric" key={key}>
            <div>
              <span>{t(`director.${key}`)}</span>
              <Icon size={19} />
            </div>
            <strong>{value.toLocaleString(i18n.language)}</strong>
            {sub && <small>{sub}</small>}
          </div>
        ))}
        {[
          ['finesOut', data.fines?.outstanding ?? 0],
          ['finesIn', data.fines?.collected ?? 0],
        ].map(([key, value]) => (
          <div className="metric" key={key}>
            <div>
              <span>{t(`director.${key}`)}</span>
            </div>
            <strong>{value.toFixed(2)}</strong>
          </div>
        ))}
      </div>
      <OverviewCharts data={data} />
      <TrendPanels />
      <div className="dashboard-grid">
        <section className="panel">
          <h2>{t('director.popular')}</h2>
          {data.popularTitles.length ? (
            <ol className="popular-list">
              {data.popularTitles.map((item) => (
                <li key={String(item._id)}>
                  <span>{item.title}</span>
                  <progress value={item.loans} max={maxLoans} aria-label={item.title} />
                  <small className="muted">
                    {item.loans} {t('director.loans')}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title={t('director.none')} />
          )}
        </section>
        <section className="panel">
          <h2>{t('director.recent')}</h2>
          {data.recent.length ? (
            data.recent.map((entry) => (
              <div className="activity-row" key={entry._id}>
                <span className="activity-icon">
                  <ArrowRightLeft size={16} />
                </span>
                <div>
                  <strong>{entry.action.replaceAll('.', ' ').replaceAll('_', ' ')}</strong>
                  <small>{entry.actor?.name}</small>
                </div>
                <time>{date(entry.createdAt)}</time>
              </div>
            ))
          ) : (
            <Empty title={t('director.none')} />
          )}
          <div className="quick-actions">
            {[
              ['/staff/audit', t('director.audit')],
              ['/staff/fines', t('director.fines')],
            ].map(([to, label]) => (
              <Link key={to} to={to}>
                <div>
                  <strong>{label}</strong>
                </div>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
