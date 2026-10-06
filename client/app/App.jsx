import { useTranslation } from 'react-i18next'
import Recovery from '../features/auth/pages/RecoveryPage'
import LibrarySettings from '../features/settings/pages/LibrarySettingsPage'
import EmailOutbox from '../features/email/pages/EmailPage'
import ContactMessages from '../features/contact/pages/ContactMessagesPage'
import PublicLayout from './layouts/PublicLayout'
import StaffLayout from './layouts/StaffLayout'
import Protected from '../features/auth/components/ProtectedRoute'
import { Link, Route, Routes } from 'react-router-dom'
import Home from '../features/home/pages/HomePage'
import About from '../features/about/pages/AboutPage'
import Services from '../features/content/pages/ServicesPage'
import HowToJoin from '../features/content/pages/HowToJoinPage'
import Rules from '../features/content/pages/RulesPage'
import News, { NewsDetailPage } from '../features/content/pages/NewsPage'
import Join from '../features/content/pages/JoinPage'
import ContentManager from '../features/content/pages/ContentManagerPage'
import Taxonomy from '../features/taxonomy/pages/TaxonomyPage'
import Fines from '../features/fines/pages/FinesPage'
import Applications from '../features/applications/pages/ApplicationsPage'
import Help from '../features/help/pages/HelpPage'
import Faq from '../features/faq/pages/FaqPage'
import Catalog from '../features/catalog/pages/CatalogPage'
import { BookDetails } from '../features/catalog/pages/BookDetailsPage'
import Login from '../features/auth/pages/LoginPage'
import MemberLayout from './layouts/MemberLayout'
import {
  MemberDashboard,
  MyBooks,
  BorrowingHistory,
  MemberReservations,
  MemberFines,
  ReadingList,
  MemberNotifications,
  MemberProfile,
  MemberSettings,
} from '../features/account/pages/MemberPages'
import Profile from '../features/account/pages/ProfilePage'
import Dashboard from '../features/dashboard/pages/DashboardPage'
import Inventory from '../features/inventory/pages/InventoryPage'
import Members from '../features/members/pages/MembersPage'
import Circulation from '../features/circulation/pages/CirculationPage'
import Reservations from '../features/reservations/pages/ReservationsPage'
import Reports from '../features/reports/pages/ReportsPage'
import AuditLog from '../features/audit/pages/AuditPage'
import Policies from '../features/policies/pages/PoliciesPage'
function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="container page">
      <h1>{t('ui.notFound.title')}</h1>
      <p className="muted">{t('ui.notFound.text')}</p>
      <Link className="button" to="/">
        {t('ui.notFound.home')}
      </Link>
    </div>
  )
}
export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="help" element={<Help />} />
        <Route path="contact" element={<Help />} />
        <Route path="services" element={<Services />} />
        <Route path="how-to-join" element={<HowToJoin />} />
        <Route path="join" element={<Join />} />
        <Route path="rules" element={<Rules />} />
        <Route path="news" element={<News />} />
        <Route path="news/:id" element={<NewsDetailPage />} />
        <Route path="faq" element={<Faq />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="book/:bookId" element={<BookDetails />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Login />} />
        <Route path="forgot-password" element={<Recovery />} />
        <Route path="reset-password" element={<Recovery />} />
        <Route path="verify-email" element={<Recovery />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route element={<Protected />}>
        <Route path="account" element={<MemberLayout />}>
          <Route index element={<MemberDashboard />} />
          <Route path="books" element={<MyBooks />} />
          <Route path="reservations" element={<MemberReservations />} />
          <Route path="history" element={<BorrowingHistory />} />
          <Route path="fines" element={<MemberFines />} />
          <Route path="reading-list" element={<ReadingList />} />
          <Route path="notifications" element={<MemberNotifications />} />
          <Route path="profile" element={<MemberProfile />} />
          <Route path="settings" element={<MemberSettings />} />
        </Route>
      </Route>
      <Route element={<Protected staff />}>
        <Route path="staff" element={<StaffLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route element={<Protected roles={['admin', 'librarian', 'director']} />}>
            <Route path="reports" element={<Reports />} />
            <Route path="fines" element={<Fines />} />
          </Route>
          <Route element={<Protected roles={['admin', 'director']} />}>
            <Route path="audit" element={<AuditLog />} />
          </Route>
          <Route element={<Protected roles={['admin', 'librarian']} />}>
            <Route path="inventory" element={<Inventory />} />
            <Route path="members" element={<Members />} />
            <Route path="circulation" element={<Circulation />} />
            <Route path="reservations" element={<Reservations />} />
            <Route path="content" element={<ContentManager />} />
            <Route path="categories" element={<Taxonomy kind="categories" />} />
            <Route path="authors" element={<Taxonomy kind="authors" />} />
            <Route path="publishers" element={<Taxonomy kind="publishers" />} />
            <Route path="applications" element={<Applications />} />
            <Route path="contact" element={<ContactMessages />} />
          </Route>
          <Route element={<Protected admin />}>
            <Route path="team" element={<Members team />} />
            <Route path="policies" element={<Policies />} />
            <Route path="settings" element={<LibrarySettings />} />
            <Route path="email" element={<EmailOutbox />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
