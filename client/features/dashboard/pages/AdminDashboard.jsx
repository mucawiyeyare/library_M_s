import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  ClipboardList,
  Coins,
  Plus,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { api } from '../../../shared/lib/api'
import { formatDate } from '../../../shared/lib/date'
import { Empty, ErrorState, Loading, PageHeading } from '../../../shared/components/ui'
import { useAuth } from '../../auth/providers/AuthProvider'
import OverviewCharts from '../components/OverviewCharts'
import { MetricTiles, OverdueTable, QuickLinks, TrendPanels } from '../components/DashboardParts'

// Administrator overview: the whole system, people and configuration in one place.
export default function AdminDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const report = useQuery({ queryKey: ['reports'], queryFn: () => api('/staff/reports') })
  if (report.isPending) return <Loading />
  if (report.error) return <ErrorState error={report.error} retry={() => void report.refetch()} />
  const data = report.data
  const roleCount = (role) =>
    data.membership
      .filter((item) => item._id.role === role)
      .reduce((sum, item) => sum + item.count, 0)
  return (
    <>
      <PageHeading
        eyebrow={t('ui.dash.adminEyebrow')}
        title={t('ui.dash.goodToSee', { name: user?.name.split(' ')[0] })}
      >
        <Link className="button" to="/staff/circulation">
          <Plus size={18} aria-hidden="true" />
          {t('ui.circ.issueTitle')}
        </Link>
      </PageHeading>
      <MetricTiles
        tiles={[
          {
            title: t('director.titles'),
            value: data.titles,
            icon: BookOpen,
            sub: t('director.copies', { count: data.copies }),
          },
          { title: t('director.active'), value: data.members, icon: Users },
          {
            title: t('ui.dash.currentLoans'),
            value: data.activeLoans,
            icon: ArrowRightLeft,
            sub: t('ui.dash.waiting', { count: data.waiting }),
          },
          {
            title: t('director.applications'),
            value: data.pendingApplications,
            icon: ClipboardList,
          },
          { title: t('director.overdue'), value: data.overdueTotal, icon: ArrowRightLeft },
          {
            title: t('fines.outstanding'),
            value: data.fines?.outstanding,
            icon: Coins,
            money: true,
          },
          { title: t('fines.collected'), value: data.fines?.collected, icon: Coins, money: true },
          { title: t('fines.waived'), value: data.fines?.waived, icon: Coins, money: true },
        ]}
      />
      <section className="panel">
        <h2>{t('ui.dash.systemAdmin')}</h2>
        <p className="muted">
          {t('ui.dash.usersByRole', {
            admins: roleCount('admin'),
            directors: roleCount('director'),
            librarians: roleCount('librarian'),
            members: roleCount('member'),
          })}
        </p>
        <QuickLinks
          links={[
            ['/staff/team', ShieldCheck, t('ui.dash.usersRoles'), t('ui.dash.usersRolesText')],
            ['/staff/policies', Settings2, t('nav.policies'), t('ui.dash.policiesText')],
            ['/staff/settings', Settings2, t('nav.settings'), t('ui.dash.settingsText')],
            ['/staff/content', Settings2, t('nav.siteContent'), t('ui.dash.contentText')],
            ['/staff/reports', BarChart3, t('nav.reports'), t('ui.dash.reportsText')],
            ['/staff/audit', ShieldCheck, t('nav.audit'), t('ui.dash.auditText')],
          ]}
        />
      </section>
      <OverviewCharts data={data} />
      <TrendPanels />
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <h2>{t('ui.dash.needsAttention')}</h2>
              <p className="muted">{t('ui.dash.overdueIntro')}</p>
            </div>
            <Link className="text-link" to="/staff/reports">
              {t('ui.dash.viewReport')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <OverdueTable data={data} />
        </section>
        <section className="panel">
          <h2>{t('ui.dash.quickActions')}</h2>
          <QuickLinks
            links={[
              ['/staff/inventory', BookOpen, t('ui.dash.growCollection'), t('ui.dash.booksText')],
              ['/staff/members', Users, t('ui.dash.manageMembers'), t('ui.dash.membersText')],
              [
                '/staff/circulation',
                ArrowRightLeft,
                t('ui.dash.borrowReturn'),
                t('ui.dash.borrowReturnText'),
              ],
            ]}
          />
        </section>
      </div>
      <section className="panel activity-panel">
        <div className="section-heading compact">
          <div>
            <h2>{t('director.recent')}</h2>
            <p className="muted">{t('ui.dash.recentIntro')}</p>
          </div>
          <Link className="text-link" to="/staff/audit">
            {t('director.audit')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {data.recent.length ? (
          data.recent.map((entry) => (
            <div className="activity-row" key={entry._id}>
              <span className="activity-icon">
                <ArrowRightLeft size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>{entry.action.replaceAll('.', ' ').replaceAll('_', ' ')}</strong>
                <small>{entry.actor?.name ?? t('ui.dash.libraryStaff')}</small>
              </div>
              <time>{formatDate(entry.createdAt)}</time>
            </div>
          ))
        ) : (
          <Empty title={t('director.none')} />
        )}
      </section>
    </>
  )
}
