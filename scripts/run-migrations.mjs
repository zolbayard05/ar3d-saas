// One-off migration runner used because the Supabase CLI isn't installed in
// this environment. Connects directly to Postgres (SUPABASE_DB_URL) and
// runs every file in supabase/migrations/ in filename order. Idempotent —
// every migration uses IF NOT EXISTS / CREATE OR REPLACE / DROP...IF EXISTS,
// so re-running this is safe.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL is not set");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

await client.connect();
console.log(`Connected. Running ${files.length} migration(s): ${files.join(", ")}`);

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  console.log(`\n--- ${file} ---`);
  await client.query(sql);
  console.log(`OK`);
}

await client.end();
console.log("\nAll migrations applied.");
