import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRightLeft, BookOpen, ClipboardList, Users } from 'lucide-react'
import { api } from '../../../shared/lib/api'
import { ErrorState, Loading, PageHeading } from '../../../shared/components/ui'
import { useAuth } from '../../auth/providers/AuthProvider'
import OverviewCharts from '../components/OverviewCharts'
import {
  BarList,
  MetricTiles,
  OverdueTable,
  QuickLinks,
  TrendPanels,
} from '../components/DashboardParts'

const copies = (data, status) => data.inventory.find((item) => item._id === status)?.count ?? 0

// The librarian's working view: today's desk figures, trends and quick tools.
export default function LibrarianDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const report = useQuery({ queryKey: ['reports'], queryFn: () => api('/staff/reports') })
  if (report.isPending) return <Loading />
  if (report.error) return <ErrorState error={report.error} retry={() => void report.refetch()} />
  const data = report.data
  const totalMembers = data.membership
    .filter((item) => item._id.role === 'member')
    .reduce((sum, item) => sum + item.count, 0)
  return (
    <>
      <PageHeading
        eyebrow={t('ui.dash.librarianEyebrow')}
        title={t('director.hello', { name: user?.name.split(' ')[0] })}
      >
        <Link className="button" to="/staff/circulation">
          <ArrowRightLeft size={18} aria-hidden="true" />
          {t('ui.dash.openDesk')}
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
          { title: t('director.available'), value: copies(data, 'available'), icon: BookOpen },
          { title: t('director.borrowed'), value: copies(data, 'on_loan'), icon: ArrowRightLeft },
          { title: t('director.overdue'), value: data.overdueTotal, icon: ArrowRightLeft },
          { title: t('director.members'), value: totalMembers, icon: Users },
          { title: t('director.active'), value: data.members, icon: Users },
          { title: t('director.reservations'), value: data.waiting, icon: ClipboardList },
          {
            title: t('director.applications'),
            value: data.pendingApplications,
            icon: ClipboardList,
          },
        ]}
      />
      <OverviewCharts data={data} />
      <div className="dashboard-grid">
        <BarList
          title={t('director.popular')}
          unit={t('director.loans')}
          empty={t('director.none')}
          rows={data.popularTitles.map((item) => ({ label: item.title ?? '—', value: item.loans }))}
        />
        <section className="panel">
          <h2>{t('ui.dash.deskTools')}</h2>
          <QuickLinks
            links={[
              [
                '/staff/circulation',
                ArrowRightLeft,
                t('ui.dash.borrowReturn'),
                t('ui.dash.borrowReturnText'),
              ],
              ['/staff/inventory', BookOpen, t('nav.books'), t('ui.dash.booksText')],
              ['/staff/members', Users, t('nav.members'), t('ui.dash.membersText')],
              [
                '/staff/applications',
                ClipboardList,
                t('nav.applications'),
                t('ui.dash.applicationsText'),
              ],
              [
                '/staff/reservations',
                ClipboardList,
                t('nav.reservations'),
                t('ui.dash.reservationsText'),
              ],
            ]}
          />
        </section>
      </div>
      <TrendPanels />
      <section className="panel">
        <h2>{t('ui.dash.overdueReturns')}</h2>
        <p className="muted">{t('ui.dash.overdueIntro')}</p>
        <OverdueTable data={data} />
      </section>
    </>
  )
}
