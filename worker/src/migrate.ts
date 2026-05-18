import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");

async function ensureMigrationsTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString });

  await client.connect();
  await ensureMigrationsTable(client);

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  let appliedCount = 0;

  for (const file of files) {
    const existing = await client.query("SELECT 1 FROM _migrations WHERE id = $1", [file]);
    if (existing.rowCount) {
      continue;
    }

    const migrationPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(migrationPath, "utf8");

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      appliedCount += 1;
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  if (appliedCount === 0) {
    console.log("All migrations already applied.");
  } else {
    console.log(`Applied ${appliedCount} migration(s).`);
  }

  // Always reload PostgREST schema cache
  await client.query("NOTIFY pgrst, 'reload schema'");
  console.log("PostgREST schema cache reloaded.");

  await client.end();
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

