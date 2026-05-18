-- Drop and recreate with proper grants for PostgREST
DROP TABLE IF EXISTS worker_heartbeats;

CREATE TABLE worker_heartbeats (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON worker_heartbeats TO anon, authenticated, service_role;

