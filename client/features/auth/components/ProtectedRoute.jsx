import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import { Loading } from '../../../shared/components/ui'
// `staff` admits every non-member; `roles` limits a group of routes to specific roles.
// The API enforces the same rules; this only keeps people out of pages they cannot use.
export default function Protected({ staff = false, admin = false, roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (staff && user.role === 'member') return <Navigate to="/account" replace />
  if (admin && user.role !== 'admin') return <Navigate to="/staff" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/staff" replace />
  return <Outlet />
}
