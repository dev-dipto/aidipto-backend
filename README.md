# AIDIPTO — Backend

Node.js + Express + TypeScript backend for the AIDIPTO website: a database of leads and chat
conversations, an API for the contact form and Ask AIDIPTO assistant, and a built-in admin panel.

## Stack

- Express 4 + TypeScript
- SQLite via `better-sqlite3` — a single file database, zero setup, good enough for this site's
  traffic. (Swap it for Postgres/MySQL later if you outgrow it — all the SQL lives in `src/db.ts`
  and `src/routes/*.ts`.)
- JWT-based admin login (`jsonwebtoken` + `bcryptjs`)
- A static admin panel (`public/admin`) — plain HTML/CSS/JS, no build step, served by this same
  server at `/admin`

## Run it

```bash
npm install
cp .env.example .env    # then edit ADMIN_EMAIL / ADMIN_PASSWORD / JWT_SECRET
npm run dev              # http://localhost:4000, admin panel at http://localhost:4000/admin
```

`npm run build && npm start` runs the compiled version for production.

`better-sqlite3` is a native module — on first install it compiles automatically. On Windows you
may need the "Desktop development with C++" workload (Visual Studio Build Tools); on macOS the
Xcode command line tools (`xcode-select --install`); on Linux, `build-essential` and `python3`.

## Environment variables (`.env`)

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (default 4000) | API + admin panel port |
| `CORS_ORIGIN` | yes | Comma-separated list of frontend origins allowed to call the API |
| `DATABASE_PATH` | no | Where the SQLite file is created |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | yes | Admin panel login — synced into the database on every boot |
| `JWT_SECRET` | yes | Long random string used to sign admin session tokens |
| `JWT_EXPIRES_IN` | no | How long an admin login lasts (default `12h`) |
| `OPENAI_API_KEY` | no | If set, Ask AIDIPTO answers via OpenAI instead of the local knowledge base |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini` |
| `N8N_WEBHOOK_URL` | no | If set, every new lead is also POSTed here |

Change the admin password by editing `.env` and restarting the server — it re-syncs on every boot.

## API

Public:
- `POST /api/lead` — save a contact-form or chatbot lead. Body: `{ name, email, phone, company,
  website, businessType, service, requirement, budget, timeline, source, conversationSummary }`.
  `name` and `email` are required; everything else is optional. Forwards to `N8N_WEBHOOK_URL` if set.
- `POST /api/chat` — `{ message, history?, sessionId? }` → `{ reply, suggestions, source }`. Uses
  OpenAI when `OPENAI_API_KEY` is set, otherwise the same keyword-matched knowledge base the
  frontend ships with. Every message is logged (by `sessionId`) so a conversation can be reviewed.
- `GET /api/health`

Admin (require `Authorization: Bearer <token>` from `/api/auth/login`):
- `POST /api/auth/login` — `{ email, password }` → `{ token }`
- `GET /api/auth/me`
- `GET /api/leads?status=&q=&page=&pageSize=` — paginated, filterable list
- `GET /api/leads/stats` — counts for the dashboard cards
- `GET /api/leads/export.csv` — full CSV export
- `PATCH /api/leads/:id` — `{ status?, notes? }`
- `DELETE /api/leads/:id`
- `GET /api/chat-logs/:sessionId` — the messages tied to one chat session

Rate limits: 20 lead submissions / 10 minutes, 30 chat messages / minute, 10 login attempts / 15
minutes — all per IP, adjustable in `src/routes/*.ts`.

## Admin panel

Open `http://localhost:4000/admin`, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. It shows lead
counts by status, a searchable/filterable lead table, a detail drawer to update status and notes
or delete a lead, and a CSV export button. No separate build or framework — it's static files
served straight from `public/admin`, so it's easy to restyle later if you want it to match the
site's own design tokens more closely.

## Connecting the two projects

1. Start this backend (`npm run dev`, default `http://localhost:4000`).
2. In `../aidipto` (the frontend), copy `.env.example` to `.env` and set
   `VITE_API_BASE_URL=http://localhost:4000`.
3. Restart the frontend dev server. The contact form and Ask AIDIPTO now save to this backend's
   database automatically; without step 2 they keep working exactly as before, fully local.

## Security notes

- `OPENAI_API_KEY` and `N8N_WEBHOOK_URL` live only in this backend's `.env` — never in the frontend
  or in any file that ships to the browser.
- Passwords are hashed with bcrypt; admin sessions are short-lived signed JWTs, not stored server-side.
- `helmet`, rate limiting and strict CORS are on by default. Set `CORS_ORIGIN` to your real domain(s)
  before deploying.
