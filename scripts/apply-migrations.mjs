/**
 * Apply the pending Supabase migrations to the linked project.
 *
 * The Supabase CLI (`npm run db:push`) cannot be used here: this project was
 * never linked and has no `supabase_migrations.schema_migrations` history, so
 * the CLI would try to replay migrations 20260822000000..20260825000005 whose
 * schema is already live. This script instead
 *
 *   1. inspects the live database,
 *   2. reconciles the migration history with what is already applied,
 *   3. applies only the outstanding migrations, in order, one transaction each,
 *   4. records every applied version in the CLI's own history table, and
 *   5. verifies the result.
 *
 * Credentials (never commit either):
 *   SUPABASE_ACCESS_TOKEN  a personal access token (sbp_...) from the Supabase
 *                         dashboard. Used against the Management API.
 *   SUPABASE_DB_PASSWORD   the project's database password. Used with the
 *                         `pg` driver (npm i -D pg) as a fallback.
 *
 * Usage:
 *   node scripts/apply-migrations.mjs --dry-run
 *   node scripts/apply-migrations.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

/** Minimal .env reader: `KEY=value`, `#` comments, CRLF tolerated. */
function readEnvFile(path) {
  const out = {};
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const fileEnv = readEnvFile(join(ROOT, ".env"));
const env = { ...fileEnv };
for (const [k, v] of Object.entries(process.env)) if (v) env[k] = v;

const SUPABASE_URL = env.SUPABASE_URL;
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;
const DB_PASSWORD = env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL) {
  console.error("SUPABASE_URL is not set (.env or the environment).");
  process.exit(1);
}
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];

/* ── SQL execution backends ────────────────────────────────────────────── */

/** Runs SQL through the Supabase Management API with a personal access token. */
function managementApiExecutor() {
  const apiBase = env.SUPABASE_API_URL || "https://api.supabase.com";
  const url = `${apiBase}/v1/projects/${projectRef}/database/query`;
  return async (sql) => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Management API ${res.status}: ${text.slice(0, 400)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };
}

/** Runs SQL over the Postgres wire protocol with the database password. */
async function postgresExecutor() {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    throw new Error(
      "SUPABASE_DB_PASSWORD needs the `pg` driver. Run `npm i -D pg`, " +
        "or use SUPABASE_ACCESS_TOKEN instead."
    );
  }
  const { Client } = pg.default ?? pg;
  const directHost = env.SUPABASE_DB_HOST || `db.${projectRef}.supabase.co`;
  const port = Number(env.SUPABASE_DB_PORT || 5432);
  const user = env.SUPABASE_DB_USER || "postgres";

  async function tryConnect(hostToUse, userToUse) {
    const c = new Client({
      host: hostToUse,
      port,
      user: userToUse,
      password: DB_PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    });
    await c.connect();
    return c;
  }

  let client;
  try {
    const userForHost = directHost.includes("pooler.supabase.com")
      ? `postgres.${projectRef}`
      : user;
    client = await tryConnect(directHost, userForHost);
  } catch (err) {
    if (err.code === "ENETUNREACH" && !env.SUPABASE_DB_HOST) {
      // Local ISP does not support IPv6 routing to direct Supabase host; fall back to IPv4 pooler
      console.log("direct IPv6 unreachable; falling back to Supabase IPv4 connection pooler...");
      const poolerHost = "aws-0-ap-south-1.pooler.supabase.com";
      client = await tryConnect(poolerHost, `postgres.${projectRef}`);
    } else {
      throw err;
    }
  }

  return async (sql) => {
    const res = await client.query(sql);
    return res.rows;
  };
}

async function makeExecutor() {
  if (ACCESS_TOKEN) {
    console.log("backend: Supabase Management API (SUPABASE_ACCESS_TOKEN)");
    return managementApiExecutor();
  }
  if (DB_PASSWORD) {
    console.log("backend: Postgres wire protocol (SUPABASE_DB_PASSWORD)");
    return postgresExecutor();
  }
  console.error(
    "\nNo credential for DDL.\n" +
      "The anon / service_role keys are data-plane only: they cannot run DDL.\n" +
      "Provide ONE of:\n" +
      "  SUPABASE_ACCESS_TOKEN  a personal access token (sbp_...) — dashboard > Account > Access Tokens\n" +
      "  SUPABASE_DB_PASSWORD   the project's database password — dashboard > Settings > Database\n"
  );
  process.exit(2);
}

/* ── Migration inventory ───────────────────────────────────────────────── */

/**
 * Migrations applied before the CLI ever tracked this project. They are
 * detected as one block: the last one's sentinel proves the earlier ones ran.
 */
const LEGACY_BLOCK = {
  versions: [
    "20260822000000",
    "20260822000001",
    "20260822000002",
    "20260822000003",
    "20260822000004",
    "20260825000005",
  ],
  /** products.cloudinary_public_id only exists after 20260825000005. */
  sentinel: { table: "products", column: "cloudinary_public_id" },
};

/**
 * Everything after the legacy block: detected individually.
 *
 * A sentinel says "this migration has already happened". A migration with no
 * sentinel is always applied — that is only safe for an idempotent statement
 * such as `DROP TABLE IF EXISTS`, which is why the drop has none: its table
 * is created by 20261016000006, so "the table is missing" would wrongly mean
 * "already dropped" on a database where the create has not run yet.
 */
const SENTINELS = {
  20261016000006: { table: "hero_slides" },
  20261020000006: { table: "password_reset_tokens" },
  20261020000007: { table: "categories" },
  20261020000008: { column: "menu_items", name: "category_id" },
  20261022000000: { table: "pages" },
};

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({
    version: f.slice(0, 14),
    file: f,
    path: join(MIGRATIONS_DIR, f),
    sql: readFileSync(join(MIGRATIONS_DIR, f), "utf8"),
  }));

/* ── Introspection ─────────────────────────────────────────────────────── */

const run = async (exec, sql) => {
  const res = await exec(sql);
  if (Array.isArray(res)) return res;
  return [];
};

/**
 * Dollar-quotes a SQL body so it can be embedded in an INSERT. The tag is
 * chosen so that it cannot appear inside the body.
 */
const dollarQuote = (body) => {
  let tag = "$sql$";
  while (body.includes(tag)) tag = `$${tag.slice(1, -1)}$`;
  return `${tag}${body}${tag}`;
};

const tableExists = async (exec, name) =>
  (
    await run(
      exec,
      `select 1 from information_schema.tables
     where table_schema='public' and table_name='${name}'`
    )
  ).length > 0;

const columnExists = async (exec, table, column) =>
  (
    await run(
      exec,
      `select 1 from information_schema.columns
     where table_schema='public' and table_name='${table}' and column_name='${column}'`
    )
  ).length > 0;

/* ── Main ──────────────────────────────────────────────────────────────── */

const exec = await makeExecutor();

// 1. The CLI's history table has to exist before we can record anything.
await exec("create schema if not exists supabase_migrations");
await exec(`create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
)`);

const history = new Set(
  (await run(exec, "select version from supabase_migrations.schema_migrations")).map(
    (r) => r.version
  )
);

// 2. Reconcile: detect what is already applied but untracked.
const alreadyLive = new Set();
if (await columnExists(exec, LEGACY_BLOCK.sentinel.table, LEGACY_BLOCK.sentinel.column)) {
  for (const v of LEGACY_BLOCK.versions) alreadyLive.add(v);
}
for (const [version, s] of Object.entries(SENTINELS)) {
  const present = s.column
    ? await columnExists(exec, s.column, s.name)
    : await tableExists(exec, s.table);
  if (present) alreadyLive.add(version);
}

for (const v of alreadyLive) {
  if (history.has(v)) continue;
  const file = migrationFiles.find((m) => m.version === v);
  // The body is a dollar-quoted string literal, NOT wrapped in single quotes:
  // the migration files contain single quotes of their own, which would
  // terminate the literal early and make Postgres parse the file as SQL.
  // It is wrapped in ARRAY[] because the column is text[]: a bare literal
  // would be coerced by parsing it as an array literal.
  await exec(
    `insert into supabase_migrations.schema_migrations (version, statements, name)
     values ('${v}', ARRAY[${dollarQuote(file ? file.sql : "")}], '${file ? file.file : v}.sql')
     on conflict (version) do nothing`
  );
  history.add(v);
  console.log(`reconciled ${v} (already live, now tracked)`);
}

// 3. Apply what is outstanding.
const pending = migrationFiles.filter((m) => !history.has(m.version));
console.log(`\n${pending.length} migration(s) pending:`);
for (const m of pending) console.log(`  ${m.version}  ${m.file}`);

if (dryRun) {
  console.log("\n--dry-run: nothing was executed.");
  process.exit(0);
}

for (const m of pending) {
  console.log(`\napplying ${m.file} ...`);
  try {
    await exec(m.sql);
  } catch (err) {
    console.error(`\nFAILED at ${m.file}:\n${err.message}`);
    process.exit(1);
  }
  await exec(
    `insert into supabase_migrations.schema_migrations (version, statements, name)
     values ('${m.version}', ARRAY[${dollarQuote(m.sql)}], '${m.file}')
     on conflict (version) do nothing`
  );
  console.log(`applied ${m.version}`);
}

// 4. Verify.
console.log("\nverification");
const checks = [
  ["table categories", await tableExists(exec, "categories")],
  ["table hero_slides", await tableExists(exec, "hero_slides")],
  ["table promo_banners", await tableExists(exec, "promo_banners")],
  ["table footer_sections", await tableExists(exec, "footer_sections")],
  ["table footer_links", await tableExists(exec, "footer_links")],
  ["table password_reset_tokens", await tableExists(exec, "password_reset_tokens")],
  ["table site_categories dropped", !(await tableExists(exec, "site_categories"))],
  ["menu_items.category_id", await columnExists(exec, "menu_items", "category_id")],
  ["menu_items.badge_variant", await columnExists(exec, "menu_items", "badge_variant")],
  ["menu_items.level", await columnExists(exec, "menu_items", "level")],
  ["menu_items.promo_cta_path", await columnExists(exec, "menu_items", "promo_cta_path")],
  ["products.category_id", await columnExists(exec, "products", "category_id")],
  ["table pages", await tableExists(exec, "pages")],
  ["table page_sections", await tableExists(exec, "page_sections")],
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
