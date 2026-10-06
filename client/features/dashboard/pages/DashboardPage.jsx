import { useAuth } from '../../auth/providers/AuthProvider'
import AdminDashboard from './AdminDashboard'
import DirectorDashboard from './DirectorDashboard'
import LibrarianDashboard from './LibrarianDashboard'
// Each role lands on its own dashboard; members use /account.
export default function DashboardPage() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <AdminDashboard />
  if (user?.role === 'director') return <DirectorDashboard />
  return <LibrarianDashboard />
}
