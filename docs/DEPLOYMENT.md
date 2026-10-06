# Deploying the Garbaharey Public Library system

One Node.js service (the API plus the built website) talking to a MongoDB replica set on the same computer.

```
Browser ──https──► reverse proxy / host ──► Node (Express API + built React site) ──► local MongoDB (127.0.0.1:27018)
```

## 1. The database (local MongoDB)

The library uses a MongoDB **replica set** on the same computer, because lending, returns and
fines use transactions. A plain (standalone) MongoDB is not enough.

1. Install **MongoDB Community Server** (8.x). On this computer it is already installed at
   `C:/Program Files/MongoDB/Server/8.0`. Its Windows service on port 27017 is a standalone
   server and is **left unchanged**.
2. Start the library's own replica set (port 27018, data in `.local-mongodb/data`):

   ```bash
   npm run db:start
   ```

   It uses `MONGOD_PATH` from `server/.env` when `mongod` is not on the PATH. Run it again
   after the computer restarts (or create a scheduled task that runs it at start-up).

3. Point the server at it in `server/.env`:

   ```
   MONGODB_URI=mongodb://127.0.0.1:27018/biblioteca?replicaSet=biblioteca-rs
   ```

4. The database listens only on `127.0.0.1`, so it is not reachable from the network. Keep it
   that way; the website reaches it through the Node server.
5. **Backups**: install **MongoDB Database Tools** (for `mongodump`; not installed yet on this
   computer), then run `npm run backup`. Files go to `backups/`. Schedule it daily and copy the
   files to another disk. Restore with `mongorestore --gzip --archive=<file>`.

## 2. Environment variables

Set these on the host (never commit them, never put them in the React code):

| Variable                                            | Required       | Notes                                                                                                                              |
| --------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                          | yes            | `production`                                                                                                                       |
| `MONGODB_URI`                                       | yes            | The local replica set above, e.g. `mongodb://127.0.0.1:27018/biblioteca?replicaSet=biblioteca-rs`.                                 |
| `JWT_SECRET`                                        | yes            | 48+ random bytes: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Production refuses placeholder text. |
| `CLIENT_ORIGIN`                                     | yes            | The public address, e.g. `https://library.example.org`. Must be `https://` in production.                                          |
| `PORT`                                              | no             | Default `4000`.                                                                                                                    |
| `SERVE_CLIENT`                                      | recommended    | `true` serves `client/dist` from the same service (one origin, no CORS setup).                                                     |
| `TRUST_PROXY`                                       | behind a proxy | Number of proxies in front (usually `1`). Without it every visitor shares the proxy's IP and rate limits misfire.                  |
| `MAIL_TRANSPORT`                                    | no             | `preview` (default; emails are stored for staff to read) or `smtp`.                                                                |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` | for `smtp`     | For Gmail use an app password.                                                                                                     |

If the configuration is unsafe, the server prints the reasons and exits instead of starting.

## 3. Build and run

```bash
npm ci
npm run build           # builds the website into client/dist
NODE_ENV=production SERVE_CLIENT=true node server/index.js
```

Or with Docker (`Dockerfile` in the project root; not yet run in CI, so build it once and check `/api/health`):

```bash
docker build -t garbaharey-library .
docker run -p 4000:4000 --env-file production.env garbaharey-library
```

Inside Docker, `127.0.0.1` is the container itself: use `mongodb://host.docker.internal:27018/biblioteca?directConnection=true` and let `mongod` listen on that address too, or run the Node server directly on the computer instead (simpler).

Put it behind HTTPS (Caddy, nginx, a platform router). Forward `X-Forwarded-For` and set `TRUST_PROXY=1`.
Cookies are `Secure` and `SameSite=Strict` in production, so the site must be served over HTTPS.

## 4. First start

1. Create the first administrator (only works while no admin exists):

   ```bash
   ADMIN_NAME="Library Administrator" ADMIN_EMAIL="you@example.org" ADMIN_PASSWORD="a-long-unique-password" npm run bootstrap:admin
   ```

2. Sign in and, in the staff area:
   - **Library details**: name, address, phone, email and opening hours (nothing is pre-filled for production).
   - **Loan policies**: loan length, limits, fines (off until you enable them) and reservation hold days.
   - **Site content**: services, how to join, library rules, about, news and events, in English, Somali and Arabic.
   - **Categories / Authors / Publishers**, then add books.
3. Demo accounts and sample books are created **only** in development, never in production.

## 5. Checks after deploying

- `GET /api/health` returns `{"status":"ok"}` (503 means the database is unreachable).
- Sign in works, and refreshing the page keeps you signed in.
- Switch EN / SO / AR and Light / Dark; Arabic should flip the layout right-to-left.
- Submit a Join the Library application and approve it as staff.
- Check Staff → Email outbox (in `preview`) or your inbox (in `smtp`).

## 6. Security checklist

- [ ] MongoDB listens on 127.0.0.1 only; the database folder is readable only by the account running it.
- [ ] `JWT_SECRET` random and unique to this deployment; rotating it signs everyone out.
- [ ] HTTPS only; `CLIENT_ORIGIN` is the exact public https address.
- [ ] `TRUST_PROXY` matches the number of proxies.
- [ ] No `.env` files or secrets in the repository or container image.
- [ ] `npm run backup` scheduled daily, copies kept on another disk, and a restore tested.
- [ ] Administrators use long unique passwords; only people who need it have the Director or Administrator role.
- [ ] `npm audit --omit=dev` is clean before each release.

Built in: Argon2id password hashing, hashed single-use reset tokens, short-lived access tokens with rotating refresh cookies, role checks on every API route, request validation, rate limits on sign-in and public forms (plus a general limit in production), an origin check on state-changing requests, security headers (Helmet), audit logging, and archived (never erased) records.

## 7. Tests

```bash
npm test         # server tests (starts a temporary in-memory MongoDB; first run downloads it)
npm run lint
```

## 8. Known limits

- The interface is fully available in English, Somali and Arabic. Error messages that come
  from the server (validation and permission messages) and the emails it sends, apart from
  membership approval and rejection, are in English.
- The Somali and Arabic wording was written without a native-speaker review; have it checked
  before public launch.
- PDF output uses the browser's "Save as PDF" from the print dialog.
- SMS and online payments are not implemented (in-app notices and email are).
- Sign-in lockout is per IP address through rate limiting, not per account.
