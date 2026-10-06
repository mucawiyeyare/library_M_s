# Garbaharey Public Library Management System

A feature-based MERN library system: React (JavaScript) with Tailwind, Express and MongoDB/Mongoose, JWT with Argon2id. The website is available in English, Somali and Arabic (right-to-left) with light and dark themes.

**Database:** a local MongoDB replica set (`npm run db:start`, port 27018). **Deploying?** See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). **Quick local start:** `npm install`, then `npm run dev:local` runs the API with a temporary in-memory database, sample books and demo accounts (admin, librarian, director, member; password `Library-Demo-2026!`, development only).

## Install dependencies

Requires Node.js 24+ and npm. From the project root:

```powershell
npm install
```

The project uses npm workspaces. This installs both applications; each has its own package.json and development command.

## Run with persistent local data

On this computer, `server/.env` already points to the separate library MongoDB on **127.0.0.1:27018**, replica set `biblioteca-rs`. Existing data remains in `.local-mongodb/data`. The original MongoDB service on port 27017 is unchanged.

Terminal 1 - server:

```powershell
cd C:\Users\hp\Desktop\Library\server
npm run db:start
npm run dev
```

Terminal 2 - client:

```powershell
cd C:\Users\hp\Desktop\Library\client
npm run dev
```

Open **http://localhost:5173**. The API listens on port **4000**. Stop each app with Ctrl+C in its terminal. MongoDB remains running and stores records across app/computer restarts; run `npm run db:start` after restarting the computer.

Root `npm run dev` only prints the separate-terminal instructions. It does not launch both apps. Root `dev:client` and `dev:server` remain aliases for convenience.

## Set up another developer's local MongoDB

1. Install Node.js and MongoDB Community Server, then run `npm install` at the project root.
2. Copy `server/.env.example` to `server/.env`.
3. Generate a unique secret and paste it into JWT_SECRET in `server/.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

4. If mongod is not on PATH, set MONGOD_PATH in `server/.env` to the installed executable's absolute path. Windows example: `C:/Program Files/MongoDB/Server/<your-version>/bin/mongod.exe`. On macOS/Linux use the installed mongod path or PATH command.
5. From `server/`, run `npm run db:start`. This creates a persistent library-only replica set on 27018 with data under the project-root `.local-mongodb/data`, without changing an existing MongoDB service. Then start client and server in separate terminals as above.

Alternatively, point MONGODB_URI in `server/.env` to an existing local **replica set**, including the correct database and replica-set name, and skip `db:start`. For example: `mongodb://127.0.0.1:27017/biblioteca?replicaSet=rs0`. A standalone MongoDB cannot support the transactions used by circulation; the separate library instance avoids modifying your existing service. Each developer uses their own database and secret; these files/data are not committed.

## Create the first administrator

From `server/`, with MongoDB running:

```powershell
$env:ADMIN_NAME = 'Library Administrator'
$env:ADMIN_EMAIL = 'your-admin@example.com'
$env:ADMIN_PASSWORD = 'use-your-own-unique-password-at-least-12-characters'
npm run bootstrap:admin
Remove-Item Env:ADMIN_PASSWORD
```

The bootstrap refuses to run if an administrator already exists. Further role changes use authenticated member management. Never commit `server/.env`.

Add real books and members through the staff workspace. `npm run seed` in `server/` is optional and adds sample books; normal development commands never seed or replace data.

## Temporary preview only

Root `npm run dev:local` starts a temporary replica set and both applications with sample records. It prints temporary administrator credentials. Its data is discarded when stopped. Use the separate `client/server` dev commands above for actual persistent records.

## Implemented

- Catalog search, genre/availability filters, sorting, pagination, details, and shelf locations.
- Reader registration, JWT sign-in/refresh/sign-out, role permissions.
- Persistent saved titles, profile names, loan history, renewals, reservations, cancellation, in-app notifications and overdue alerts.
- Staff title editing/archiving, copy registration, shelf changes, retirement/restoration, member registration, membership status, administrator-controlled staff roles.
- Transactional issue/return/renewal, borrowing limits, overdue restrictions, reservation priority, audit history.
- Staff overview, overdue and loaded-inventory CSV exports, and loan policies.

## Checks

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Integration tests start an isolated real MongoDB replica set. Browser tests start a separate client on port 5174 and temporary API. Set `$env:PLAYWRIGHT_CHANNEL = 'chrome'` to use an installed Chrome instead of downloading Chromium.

## Manual backup

Install MongoDB Database Tools, then run `npm.cmd run backup`. Archives are written under ignored `backups/`. Run in a quiet maintenance window: this database-specific dump has no point-in-time oplog snapshot. Verify restoration into a separate database using `mongorestore --archive=<file> --gzip` and an appropriate destination connection before relying on backups. Scheduling and deployment are deferred.

See [architecture and current limits](docs/ARCHITECTURE.md). The original prototype is archived in `docs/archive/frontend-prototype.zip`; the active entry is `client/main.jsx`.

## Project folders

`client/` contains the website, its HTML entry, public assets, and browser tests. `server/` contains the API, browser-safe validation contracts, and database integration tests. `docs/` contains architecture notes and previews. Root configuration files coordinate both applications. Reusable `shared/` folders inside each application are normal: they hold infrastructure used by multiple features.

`node_modules`, build output, test results, `.cache`, and `.local-mongodb` are generated or local data folders. They are hidden in the workspace Explorer; keep `.local-mongodb` to preserve your library database.

Public pages include Home, Catalog, Book Details, About, Borrowing Help, and Sign In/Register. Contact/location/opening hours need verified library information before adding them.

## Public contact details

Help (`/help`) is the contact page; `/faq` contains FAQs and live borrowing rules. Administrators configure public contact details through Library details; changes appear without client environment changes. Contact form submissions are stored in MongoDB and visible to librarians/admins under Staff workspace > Contact messages. Staff can mark requests as handled; email replies must be sent outside the system. Email delivery is not implemented.

Staff can upload JPEG, PNG, or WebP book covers up to 5 MB when adding or editing a title. Validated images are optimized to WebP and stored in MongoDB, included in database backups. Titles without covers use the generated title/author design. Removing a cover reference restores that design; unused image records are retained.

## Gmail, account recovery, and library details

Administrator > **Library details** controls the public name, email, phone, address, hours, timezone, email toggle, and reminder lead time. Public pages read these values from MongoDB. Initial defaults are Khaliil Library, ibrahimahmedabdirahmaan@gmail.com, +252 616875280, Somalia, open 24 hours every day, Africa/Mogadishu. Change the address to your actual street/location when ready. Client environment contact values are no longer used.

Gmail setup (server/.env):

```dotenv
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=ibrahimahmedabdirahmaan@gmail.com
SMTP_PASSWORD=your-gmail-app-password
```

Enable Google 2-Step Verification, generate an app password, and save it under Administrator > Email outbox > Configure Gmail delivery, or enter it in the ignored server/.env. Do not use your normal Gmail password. From server/, run `npm run email:check` to verify SMTP authentication without sending an email. Admin changes are written atomically to server/.env and applied immediately; manual file edits require a server restart. The admin Test saved Gmail connection action checks authentication without sending mail. [Google app-password instructions](https://support.google.com/accounts/answer/185833). Missing credentials leave emails pending; they are not reported as delivered. Administrators inspect delivery in **Email outbox** and retry failed messages. Gmail accepted a message when status is sent; inbox arrival is not guaranteed by SMTP acceptance.

Use `MAIL_TRANSPORT=preview` for local development without email delivery. Only administrators can inspect preview bodies, and production never exposes message bodies. Preview records can be requeued after switching to SMTP, but expired recovery links require a new recovery request. Browser/integration tests force preview mode and never send real email.

Forgot Password is available from Sign in. Recovery links expire after 30 minutes, are stored hashed, are consumed once, and revoke existing access/refresh sessions when used. Verification links expire after 24 hours. Registration queues verification; existing readers can resend verification under My library > Profile. Verification does not grant staff roles or block existing members from sign-in. Borrowing notifications and daily due/overdue reminders are emailed only to active users with verified addresses. Reminder lead time is configurable. The server queues reminders hourly and processes delivery every 30 seconds while running; restart recovery catches up on active loans. Contact replies queue through the staff inbox.

## Large collections

Staff titles/members support server search and pagination. Copies, circulation, reservations, audit, contact inbox, and email outbox are paginated; circulation pickers search all active members/available copies. Reader loan/reservation history is also paginated. Inventory and overdue CSV exports stream all matching rows, independent of loaded pages, with spreadsheet-formula escaping. Legacy unpaginated API responses retain their historical limits; use page/limit parameters for full traversal. Dashboard overdue rows are a 10-row preview with a separate total.

Email bodies are encrypted at rest with a key derived from JWT_SECRET; sent bodies are cleared. Keep that secret stable to deliver queued messages. If it is rotated, old queued bodies cannot be decrypted and recovery links must be requested again.

## Staff workspace and reports

The fixed workspace header shows the signed-in profile and sign-out control. The fixed sidebar retains its original desktop width; its logo stays fixed while only the navigation list scrolls. The header profile dropdown opens My profile or signs out. Profiles are read-only until Edit profile is selected. Members lists reader accounts; administrator-only Admins & staff lists and creates librarians/administrators directly. Public registration continues to create members only.

Reports include icon summaries, member/staff status totals, reservation outcomes, monthly loans issued over the last 12 months (UTC), the 10 most borrowed titles, genre totals, paginated overdue details, and complete inventory/overdue/loan/reservation CSV exports. Aggregated totals include all matching records; popular titles is explicitly a top-10 report. Financial reports remain unavailable because fines/payments are not implemented.

Exports support search, status, and inclusive start/end date filters in UTC. Loan dates can refer to issue, due, or return date; reservation dates refer to requests, and inventory dates refer to copy creation. Filtered CSV downloads include all matching records, independent of pagination. The desktop export controls use two rows; CSV is the complete dataset format. Overview charts show a zero-filled 12-month circulation trend and inventory status counts.

Gmail app passwords are never returned through status/settings APIs or written into audit details. A blank app password preserves the existing value for the same sender; changing the sender requires a new password for SMTP. The server process needs write access to server/.env for admin configuration.

Profile photos accept JPEG, PNG, or WebP up to 5 MB, are decoded and cropped to 320px WebP, and persist in MongoDB. Camera uploads save immediately; account field changes use Save profile. Old photo records are replaced. Name changes keep the session; email/password changes require the current password, consume old recovery/verification links, revoke all sessions, and require sign-in again. Changed email addresses need verification. The profile editor is shared by the reader account tab and staff profile page. Navigation remains scrollable with its scrollbar hidden.

Profile photo selection opens a circular crop preview with drag/arrow positioning, zoom, reset, and explicit Save photo/Cancel actions. No photo is uploaded until Save photo is selected. The editor uses an inline camera button and hides file names and metadata; the Edit profile action sits inside the profile card.

Administrators configure the business logo and name in Library details. Upload a JPEG, PNG, or WebP logo, choose Show business name beside logo (off for logo-only), then save. Branding applies to the sidebar and public site. The sidebar includes a fixed Sign out footer. The photo-crop dialog fits the viewport without internal scrolling, including shorter mobile screens.
