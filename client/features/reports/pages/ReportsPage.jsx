import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Archive,
  ArrowRightLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  Library,
  Users,
} from 'lucide-react'
import { api } from '../../../shared/lib/api'
import { ErrorState, Loading, PageHeading } from '../../../shared/components/ui'
import { MetricTiles } from '../../dashboard/components/DashboardParts'
import ReportBuilder from '../components/ReportBuilder'
import ExportPanel from '../components/ExportPanel'

const copies = (data, status) => data.inventory.find((item) => item._id === status)?.count ?? 0

// Summary figures, the report builder (every report, filterable, CSV and print) and
// record-level CSV exports.
export default function ReportsPage() {
  const { t } = useTranslation()
  const report = useQuery({ queryKey: ['reports'], queryFn: () => api('/staff/reports') })
  if (report.isPending) return <Loading />
  if (report.error) return <ErrorState error={report.error} retry={() => void report.refetch()} />
  const data = report.data
  return (
    <>
      <div className="no-print">
        <PageHeading eyebrow={t('reports.eyebrow')} title={t('reports.title')} />
        <MetricTiles
          tiles={[
            { title: t('director.titles'), value: data.titles, icon: BookOpen },
            { title: t('director.available'), value: copies(data, 'available'), icon: Library },
            { title: t('director.active'), value: data.members, icon: Users },
            { title: t('ui.dash.currentLoans'), value: data.activeLoans, icon: ArrowRightLeft },
            { title: t('director.overdue'), value: data.overdueTotal, icon: Clock },
            {
              title: t('ui.reports.returned'),
              value: data.returnedLoans,
              sub: t('ui.reports.totalIssued', { count: data.totalLoans }),
              icon: CheckCircle2,
            },
            { title: t('director.reservations'), value: data.waiting, icon: ClipboardList },
            {
              title: t('ui.reports.unavailable'),
              value: copies(data, 'retired') + copies(data, 'damaged') + copies(data, 'lost'),
              icon: Archive,
            },
          ]}
        />
      </div>
      <ReportBuilder />
      <div className="no-print">
        <ExportPanel />
      </div>
    </>
  )
}
