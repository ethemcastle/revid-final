# Revid Monorepo

This repository is split into two deployable services:

- `web/`: Next.js app (public)
- `worker/`: Node.js background worker (internal)

The services communicate only through Supabase tables.

## Structure

- `web/src/app/api/worker-status/route.ts`: reads worker heartbeat
- `web/src/app/dashboard/worker-status-badge.tsx`: UI badge for worker health
- `worker/src/index.ts`: polling + heartbeat loop
- `worker/src/migrate.ts`: SQL migration runner
- `worker/migrations/*.sql`: ordered migrations

## Local setup

1. Copy env templates:

```bash
cp web/.env.example web/.env.local
cp worker/.env.example worker/.env
```

2. Install dependencies at repo root:

```bash
npm install
```

3. Run web:

```bash
npm run dev:web
```

4. Run worker (separate terminal):

```bash
npm run dev:worker
```

## Build

```bash
npm run build:web
npm run build:worker
```

## Deploy

Use two Railway services:

- Web service root: `web`
- Worker service root: `worker`

Follow `deployments.md` for full environment and migration details.
