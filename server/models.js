import { LibrarySettings } from './features/settings/settings.model.js'
import { EmailMessage } from './features/email/email.model.js'
import { SecurityToken } from './features/auth/securitytoken.model.js'
import { ContactMessage } from './features/contact/contact.model.js'
import { Cover } from './features/covers/cover.model.js'
// Central model registration for startup and test setup.
import { User } from './features/members/user.model.js'
import { Book } from './features/inventory/book.model.js'
import { Copy } from './features/inventory/copy.model.js'
import { Loan } from './features/circulation/loan.model.js'
import { Reservation } from './features/reservations/reservation.model.js'
import { RefreshSession } from './features/auth/refreshsession.model.js'
import { Audit } from './features/audit/audit.model.js'
import { Notification } from './features/notifications/notification.model.js'
import { Content } from './features/content/content.model.js'
import { Application } from './features/applications/application.routes.js'
import { Category, Author, Publisher } from './features/taxonomy/taxonomy.model.js'
import { Fine } from './features/fines/fine.model.js'
import { Policy } from './features/policies/policy.model.js'
export { User } from './features/members/user.model.js'
export { Book } from './features/inventory/book.model.js'
export { Copy } from './features/inventory/copy.model.js'
export { Loan } from './features/circulation/loan.model.js'
export { Reservation } from './features/reservations/reservation.model.js'
export { RefreshSession } from './features/auth/refreshsession.model.js'
export { Audit } from './features/audit/audit.model.js'
export { Notification } from './features/notifications/notification.model.js'
export { Policy } from './features/policies/policy.model.js'
export { getPolicy } from './features/policies/policy.model.js'
export const allModels = [
  LibrarySettings,
  EmailMessage,
  SecurityToken,
  ContactMessage,
  Cover,
  User,
  Book,
  Copy,
  Loan,
  Reservation,
  RefreshSession,
  Audit,
  Notification,
  Policy,
  Content,
  Application,
  Category,
  Author,
  Publisher,
  Fine,
]
