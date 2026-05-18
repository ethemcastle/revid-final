# Revide — Architecture & Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   Auth       │  │  competitor_pages │  │  worker_      │  │
│  │  (magic link)│  │  (RLS enabled)   │  │  heartbeats   │  │
│  └──────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
        ▲                    ▲                      ▲
        │                    │                      │
        │ anon key           │ anon key             │ service role
        │                    │                      │
┌───────┴────────┐    ┌──────┴───────────────────────┴──────┐
│   Web (Next.js)│    │          Worker (Node.js)            │
│   Port 3000    │    │   Polls every 15s for pending pages  │
│                │    │   Scrapes via Firecrawl               │
│  - Dashboard   │    │   Writes heartbeat every 15s         │
│  - Auth flow   │    │   Runs migrations on startup         │
│  - API routes  │    │   NO public URL (internal only)      │
└────────────────┘    └──────────────────────────────────────┘
     ▲ public URL              ▲ no inbound traffic
     │                         │
   Users                   Cron / self-loop
```

## Key Principle

**Web and Worker are separate services with separate URLs (or no URL for worker), but share the same Supabase database.** They communicate exclusively through the database — no direct HTTP calls between them.

- Web writes `status: "pending"` rows → Worker picks them up
- Worker writes results back → Web reads them via Supabase realtime/polling
- Worker writes heartbeats → Web reads them via API route

---

## Services

### Web (`/web`) — Public-facing
- **Framework:** Next.js (standalone output)
- **Purpose:** Dashboard UI, auth, API routes
- **Dockerfile:** Multi-stage build (deps → build → runner)
- **Public URL:** Yes (e.g. `https://revide-web.up.railway.app`)
- **Key:** `NEXT_PUBLIC_*` env vars are baked in at **build time**

### Worker (`/worker`) — Internal/Background
- **Runtime:** Node.js 22
- **Purpose:** Background polling, scraping, heartbeat, migrations
- **Dockerfile:** Single-stage build + `sh -c "node dist/migrate.js && node dist/index.js"`
- **Public URL:** Not needed (no inbound traffic)
- **Startup:** Runs DB migrations → starts polling loop

---

## Environment Variables

### Web (Railway)

| Variable | Required At | Description |
|----------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Build time** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Build time** | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime | For server-side admin operations |

> ⚠️ `NEXT_PUBLIC_*` vars must be available during `docker build`. Railway exposes env vars at build time by default.  
> If you change these values, you must **rebuild** (not just restart) the web service.

### Worker (Railway)

| Variable | Required At | Description |
|----------|-------------|-------------|
| `SUPABASE_URL` | Runtime | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime | Service role key (bypasses RLS) |
| `DATABASE_URL` | Runtime | Postgres pooler connection string (for migrations) |
| `FIRECRAWL_API_KEY` | Runtime | Firecrawl scraping API key |

> ℹ️ Worker does NOT need `NEXT_PUBLIC_*` vars. It uses `SUPABASE_URL` (without prefix) since it's a plain Node.js process, not Next.js.

### Getting `DATABASE_URL`

1. Go to: **Supabase Dashboard → Settings → Database**
2. Copy the **Transaction mode pooler** connection string (port `6543`)
3. It should look like:
   ```
   postgresql://postgres.cqybbmtwdnxlqgtsfbrr:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
4. ⚠️ **Must use the pooler URL** (not direct) — Railway containers cannot reach IPv6-only direct connections.

---

## How Web & Worker Communicate

They **never** call each other directly. All communication goes through Supabase:

```
User → Web: "Track this URL"
Web → Supabase: INSERT competitor_pages (status='pending')
Worker → Supabase: SELECT WHERE status='pending'
Worker: scrapes URL
Worker → Supabase: UPDATE (status='completed', raw_markdown, value_proposition)
Web → Supabase: reads updated row (realtime or poll)
Web → User: shows result
```

For health monitoring:
```
Worker → Supabase: UPSERT worker_heartbeats (every 15s)
Web API route → Supabase: SELECT worker_heartbeats
Web UI: shows green/red badge
```

---

## Database Migrations

Migrations live in `/worker/migrations/` as numbered `.sql` files.

**How it works:**
1. On every deploy, the worker container starts with `node dist/migrate.js`
2. Connects to Postgres via `DATABASE_URL` (IPv4 forced)
3. Creates a `_migrations` tracking table if it doesn't exist
4. Runs any `.sql` files not yet applied (in alphabetical order)
5. Records each applied migration
6. Then starts the worker process

**Adding a new migration:**
```bash
# Create a new migration file (use timestamp prefix for ordering)
touch worker/migrations/20260519000000_your_description.sql
```

> ℹ️ Migrations are owned by the worker because it has `DATABASE_URL` (direct Postgres access). The web service only talks to Supabase via the REST API.

---

## Deployment Checklist (Railway)

### First-time setup

- [ ] Create two **separate** services in Railway: `web` and `worker`
- [ ] Set root directory: `/web` for web service, `/worker` for worker service
- [ ] Web service: enable public networking (assign a domain)
- [ ] Worker service: **disable** public networking (no domain needed)
- [ ] Add all env vars listed above to each service
- [ ] Verify `NEXT_PUBLIC_SUPABASE_URL` is NOT empty in web service
- [ ] Verify `DATABASE_URL` uses the pooler URL (port `6543`, hostname `pooler.supabase.com`)
- [ ] Deploy both services

### On every deploy

- [ ] Worker auto-runs pending migrations on startup
- [ ] If you changed `NEXT_PUBLIC_*` vars → trigger a **rebuild** of web
- [ ] Check worker logs for `All migrations already applied` or `Applied N migration(s)`
- [ ] Check dashboard for green "Worker OK" badge

### Scaling considerations

- **Web** can be scaled horizontally (multiple replicas) — it's stateless
- **Worker** should run as a **single replica** to avoid duplicate processing
- If you need multiple workers, add row-level locking (`FOR UPDATE SKIP LOCKED`) to the polling query

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Invalid API key` in browser | `NEXT_PUBLIC_SUPABASE_ANON_KEY` wrong or empty at build time | Verify env var in Railway, trigger **rebuild** |
| `ENETUNREACH` IPv6 error | Direct DB connection resolving to IPv6 | Use pooler URL in `DATABASE_URL` |
| `DATABASE_URL not set` | Missing env var in worker service | Add it in Railway worker settings |
| Worker badge shows "DOWN" | Worker not running or can't reach Supabase | Check worker logs, verify `SUPABASE_URL` |
| Migrations fail on duplicate | Migration partially applied | Check `_migrations` table in Supabase, fix manually |
| `NEXT_PUBLIC_*` empty after deploy | Env var added after build, or not set | Add var, then trigger new **build** (not restart) |

---

## File Structure

```
revide-nextjs/
├── DEPLOYMENT.md              # ← You are here
├── web/                       # SERVICE 1: Public web app
│   ├── Dockerfile
│   ├── .env.local             # Local dev env vars
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/worker-status/route.ts   # Reads heartbeat from DB
│   │   │   ├── dashboard/
│   │   │   │   ├── worker-status-badge.tsx   # Live worker status UI
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── utils/supabase/
│   │       ├── client.ts      # Browser Supabase client
│   │       ├── server.ts      # Server Supabase client
│   │       └── middleware.ts   # Auth middleware
│   └── supabase/migrations/   # Source of truth for SQL (copy to worker)
│
├── worker/                    # SERVICE 2: Background worker (no public URL)
│   ├── Dockerfile
│   ├── .env                   # Local dev env vars
│   ├── migrations/            # SQL migrations (auto-run on deploy)
│   │   ├── 20260517000000_create_competitor_pages.sql
│   │   ├── 20260517000001_add_delete_policy.sql
│   │   └── 20260518000000_create_worker_heartbeats.sql
│   └── src/
│       ├── index.ts           # Polling loop + heartbeat
│       ├── migrate.ts         # Auto-migration runner (uses DATABASE_URL)
│       ├── supabase.ts        # Supabase client (service role)
│       ├── firecrawl.ts       # Scraping via Firecrawl API
│       └── parser.ts          # Markdown → value proposition
```
DEPLOYMENT.md