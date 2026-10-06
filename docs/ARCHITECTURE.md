# Biblioteca architecture

Features own their screens, forms, routes, controllers, models, and domain services. Shared folders contain reusable infrastructure rather than domain business rules.

```text
client/
  index.html           Browser HTML entry
  public/              Static assets
  tests/e2e/           Browser workflows
  app/                 Route composition and member/staff layouts
  features/
    auth/              Provider, route guard, sign-in screen
    home/              Homepage components, page, and scoped styles
    about/             About the library
    help/              Borrowing guide and live policy FAQ
    information/       Shared public information page styles
    catalog/           Search, details, book components
    account/           Loans, reading lists, notifications, profile
    dashboard/         Staff overview
    inventory/         Titles and physical-copy management
    members/           Membership and account access
    circulation/       Issue, renewal, return
    reservations/      Reservation queue
    reports/           Overdue and inventory exports
    audit/             Administrator activity history
    policies/          Borrowing rules
  shared/
    components/        Shared states and shadcn-style primitives
    hooks/             API mutation hook
    lib/               HTTP, dates, CSV, class utilities
server/
  contracts/           Browser-safe API validation schemas
  tests/               MongoDB integration tests
  config/              Validated environment
  features/            Domain routes, controllers, services, models
  shared/              Authentication middleware and errors
  scripts/             Seed, bootstrap, local preview, backup
  app.js               Middleware and router composition
  index.js             Database and API lifecycle
docs/                  Architecture, previews, archived prototype
```

## Domain rules

- Physical copies have unique barcodes; titles have unique ISBN/catalog identifiers.
- Members access their own loans, reservations, saved books, and notifications.
- Staff issue and return copies. Members reserve titles and renew eligible loans.
- Administrators grant staff roles, read the full audit log, and update policies.
- Circulation and audited management changes use MongoDB transactions.
- Member/title version writes serialize borrowing-limit and reservation checks. A partial unique index prevents two active loans for one copy.
- JWT access tokens live in memory. Random refresh tokens are hashed in MongoDB, rotated on use, and sent in HttpOnly cookies. Production cookies require HTTPS.
- The persistent application never falls back to sample data when MongoDB is unavailable.
- `dev:local` explicitly creates an ephemeral real MongoDB replica set for development.

## Design

The previous prototype used blue gradients, serif headings, large rounded cards, and simulated account content. The redesign uses the administrator-configurable Khaliil Library name and retains core catalog/account URLs, and introduces restrained green accents, self-hosted Inter and Literata, consistent radii, practical tables, visible focus, and semantic dark-mode tokens.

UI/UX Pro Max guides the application; the taste skill guides public pages. Design variance 4, motion intensity 2, visual density 5. Radix dialogs handle focus trapping, dismissal, and restoration. Shared shadcn-style button/input primitives use Radix Slot, CVA, and Tailwind class merging.

## Current limits

Staff lists use server pagination (25 rows by default, maximum 100). Titles/members and circulation pickers search across matching records. Staff exports stream complete results; legacy array endpoints retain compatibility limits. Reader loan/reservation history is paginated. Dashboard recent activity and overdue rows are intentional previews.

Notifications are in-app and queued email. Gmail SMTP delivery, password recovery, verification, and due/overdue reminders are implemented. Gmail credentials must be configured locally. Fines/payments, deployment, and automated backup scheduling are deferred. The manual backup tool requires MongoDB Database Tools and a quiet maintenance window; restore verification remains an operational task.

The root `src/` prototype was archived in `docs/archive/frontend-prototype.zip`. Active source belongs to `client/` and `server/`. Generated client builds/tests and local database/cache folders are ignored and hidden by workspace editor settings. The contracts folder contains only validation schemas; client code never imports server controllers, secrets, or database models.

Typography uses Inter for the interface and body text, and Literata for public-page editorial headings, both self-hosted, with a 16px body baseline, 14-15px links and controls, and 12-13px supporting labels. Public pages use warm paper backgrounds and forest-green accents. Headings have a restrained scale; mobile text does not shrink below the control/label scale except decorative book-cover imprint text.

Client and server are npm workspaces with individual package.json files and `npm run dev` commands. Install once at the root, then start each workspace in its own terminal. Server configuration is loaded from server/.env by file location, independent of the working directory. Database starter and backup output remain under the project root to preserve existing data paths. See README for persistent local setup on another computer.

Email outbox records persist in MongoDB with bounded retries and leases; SMTP acceptance cannot provide exactly-once delivery across a crash after send, so duplicates are possible. Recovery tokens are hashed, expire, and are consumed transactionally; an authVersion check revokes access and refresh tokens after a reset. Library settings are administrator-controlled and public APIs expose only public fields.

## Workspace profile, exports, and email setup

The sidebar logo and label remain fixed; only navigation scrolls. The original 245px desktop width is retained. A fixed header contains the account dropdown and routes staff to /staff/profile. Member/staff creation and recovery share the password visibility component and confirm passwords before submission.

Reports export complete filtered MongoDB cursors. UTC calendar dates are inclusive and validated; status and escaped search filters combine with the chosen issue/due/return date. CSV is the full dataset format; desktop filter controls use two rows. Overview charts include accessible borrowing data and directly labeled inventory counts.

Administrator-only email configuration persists three whitelisted fields (MAIL_TRANSPORT, SMTP_USER, SMTP_PASSWORD) through serialized atomic writes to server/.env, preserves unrelated configuration, and updates the running configuration. Status responses expose only credential presence; passwords are excluded from responses and audit entries. Temporary environment files are ignored. The connection-test endpoint verifies SMTP without sending an email. Tests use isolated environment files and SMTP mocks.

Profile updates are transactionally authenticated with the current password when email or password changes. Old refresh/access sessions are revoked through authVersion; pending security tokens are deleted, a changed address is verified again, and the prior address receives a security notice. Avatar uploads validate decoded image type/pixel limits and replace the previous user-owned photo in the same transaction.
