/*
 * WorkZo AI - in-browser SQL sandbox
 *
 * WHY THIS EXISTS
 *
 * The interview code workspace could not run SQL. It printed:
 *
 *     "SQL execution not available in the interview sandbox.
 *      Describe your query logic to the recruiter verbally."
 *
 * SQL is the single most common technical screen for a data analyst, and data
 * bootcamps are the market. A data-analyst mock interview where the candidate
 * cannot run a query is not a mock interview.
 *
 * This runs SQLite compiled to WebAssembly, entirely inside the candidate's
 * browser. That fixes three problems at once:
 *
 *   1. SQL becomes executable, with a real result grid.
 *   2. No rate limit. A cohort of 30 students behind one school NAT does not
 *      throttle itself, because nothing leaves the machine.
 *   3. No GDPR question. Student code and data never cross the network, so
 *      there is no third-party processor to name in a DPA. This matters when
 *      the buyer is a German university.
 *
 * GLOBAL BY CONSTRUCTION
 *
 * The sandbox is never hardcoded to a question. It reads the schema out of a
 * question's `context` string, which the assessment engine already writes in a
 * consistent shape:
 *
 *     "Table: orders(order_id INT, customer_id INT, order_date DATE, ...)"
 *     "Tables: customers(customer_id, name, country), orders(order_id, ...)"
 *
 * ...then builds the tables and SEEDS them with data that is semantically
 * plausible for each column, inferred from the column's name and type. So a
 * question written next year, for a schema nobody has seen, becomes runnable
 * with no extra work. That is the difference between a fixture and a sandbox.
 *
 * Seeding is DETERMINISTIC (seeded PRNG). Every candidate sees identical data,
 * so a result set can be compared against a reference solution and graded. A
 * random seed would make grading impossible.
 */

/* ─────────────────────────── setup / loading ──────────────────────────── */

type SqlJsStatic = {
  Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
};

type SqlJsDatabase = {
  exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
  run: (sql: string) => void;
  close: () => void;
};

declare global {
  interface Window {
    initSqlJs?: (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

/**
 * Self-host first, CDN second.
 *
 * Self-hosting keeps the promise that nothing about the candidate leaves the
 * device. To self-host:
 *
 *     npm i sql.js
 *     cp node_modules/sql.js/dist/sql-wasm.js   public/sql/
 *     cp node_modules/sql.js/dist/sql-wasm.wasm public/sql/
 *
 * The CDN fallback exists so the feature still works if that copy step is
 * missed. It fetches a static engine binary, never any candidate data.
 */
const LOCAL_SQLJS = "/sql/sql-wasm.js";
const CDN_SQLJS = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js";

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-workzo-sql="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.workzoSql = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export async function loadSqlEngine(): Promise<SqlJsStatic> {
  if (typeof window === "undefined") throw new Error("SQL sandbox is browser-only");
  if (sqlJsPromise) return sqlJsPromise;

  sqlJsPromise = (async () => {
    let base = "/sql/";
    try {
      await loadScript(LOCAL_SQLJS);
    } catch {
      await loadScript(CDN_SQLJS);
      base = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";
    }
    if (!window.initSqlJs) throw new Error("sql.js did not initialise");
    return window.initSqlJs({ locateFile: (file: string) => `${base}${file}` });
  })();

  return sqlJsPromise;
}

/* ─────────────────────────── schema parsing ───────────────────────────── */

export type SqlColumn = { name: string; declaredType: string; kind: ColumnKind };
export type SqlTable = { name: string; columns: SqlColumn[] };

type ColumnKind =
  | "id"
  | "foreign_id"
  | "date"
  | "money"
  | "status"
  | "person_name"
  | "country"
  | "email"
  | "category"
  | "quantity"
  | "boolean"
  | "text";

/**
 * Column KIND is inferred from the column NAME first, then the declared type.
 * The name is the better signal: `total_amount DECIMAL` and `order_date DATE`
 * tell us what plausible data looks like, in a way `DECIMAL` alone never could.
 *
 * This is what makes the seeder generic. A schema this file has never seen
 * still gets sensible rows.
 */
/** orders -> order, customers -> customer, people -> people. Crude, and enough. */
function singularize(tableName: string): string {
  const n = tableName.toLowerCase();
  if (n.endsWith("ies")) return `${n.slice(0, -3)}y`;
  if (n.endsWith("ses") || n.endsWith("xes")) return n.slice(0, -2);
  if (n.endsWith("s")) return n.slice(0, -1);
  return n;
}

function inferKind(name: string, declaredType: string, tableName: string): ColumnKind {
  const n = name.toLowerCase();
  const t = (declaredType || "").toLowerCase();

  // PRIMARY vs FOREIGN key. This distinction is the whole game.
  //
  // Getting it wrong is not cosmetic. If `orders.customer_id` is seeded as a
  // primary key, every order belongs to a different customer, so GROUP BY
  // produces groups of ONE, a JOIN matches almost nothing, and
  // "customers with more than 3 orders" returns an EMPTY grid. The candidate
  // then cannot tell a correct query from a broken one, which is worse than
  // having no sandbox at all.
  //
  // Rule: the table's own id (`id`, or `<singular>_id`) is the primary key.
  // Every OTHER `*_id` column points somewhere else.
  if (n === "id" || n === `${singularize(tableName)}_id`) return "id";
  if (/_id$/.test(n)) return "foreign_id";
  if (/(date|_at|time|timestamp|created|updated|joined)/.test(n) || /date|time/.test(t)) return "date";
  if (/(amount|total|price|revenue|cost|salary|spend|value|balance|fee)/.test(n)) return "money";
  if (/(status|state)/.test(n)) return "status";
  if (/(country|region|city|location|market)/.test(n)) return "country";
  if (/(email|mail)/.test(n)) return "email";
  if (/(category|type|segment|channel|tier|plan|department)/.test(n)) return "category";
  if (/(count|qty|quantity|number|num_|units|score|age|rating)/.test(n)) return "quantity";
  if (/(is_|has_|active|enabled|deleted)/.test(n) || /bool/.test(t)) return "boolean";
  if (/(name|title|customer|product|user)/.test(n)) return "person_name";
  if (/(int|serial)/.test(t)) return "quantity";
  if (/(decimal|numeric|float|real|double)/.test(t)) return "money";
  return "text";
}

function sqliteType(kind: ColumnKind): string {
  switch (kind) {
    case "id":
    case "foreign_id":
    case "quantity":
    case "boolean":
      return "INTEGER";
    case "money":
      return "REAL";
    default:
      return "TEXT";
  }
}

/**
 * Parses the shapes the assessment engine actually writes:
 *   "Table: orders(order_id INT, customer_id INT, total_amount DECIMAL)"
 *   "Tables: customers(customer_id, name, country), orders(order_id, ...)"
 * Types are optional, because half the questions omit them.
 */
export function parseSchemaFromContext(context: string): SqlTable[] {
  const text = String(context || "").replace(/^\s*Tables?\s*:\s*/i, "");
  const tables: SqlTable[] = [];

  const tableRe = /([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = tableRe.exec(text)) !== null) {
    const tableName = match[1];
    const columns = match[2]
      .split(",")
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((raw) => {
        const parts = raw.split(/\s+/);
        const name = parts[0];
        const declaredType = parts.slice(1).join(" ");
        return { name, declaredType, kind: inferKind(name, declaredType, tableName) };
      })
      .filter((c) => c.name);

    if (columns.length) tables.push({ name: tableName, columns });
  }

  return tables;
}

/* ──────────────────────────── deterministic seed ───────────────────────── */

/** mulberry32. Deterministic, so every candidate gets the same data and the same query grades the same. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A deliberately uneven parent distribution, expanded from weights
 * [8,7,5,4,3,2,1,1]: parent 1 gets 8 children, parent 8 gets 1. This is what
 * makes GROUP BY / HAVING / ORDER BY questions actually discriminate.
 */
const FK_SKEW: number[] = [8, 7, 5, 4, 3, 2, 1, 1].flatMap((count, index) =>
  Array.from({ length: count }, () => index + 1),
);

const STATUSES = ["completed", "pending", "cancelled", "refunded"];
const COUNTRIES = ["Germany", "France", "Spain", "Poland", "Italy", "Netherlands"];
const CATEGORIES = ["groceries", "transport", "software", "hardware", "services"];
const FIRST = ["Ana", "Bruno", "Chloe", "Dimitri", "Elena", "Farid", "Greta", "Hugo", "Ines", "Jonas"];
const LAST = ["Adler", "Bauer", "Costa", "Dupont", "Esposito", "Fischer", "Garcia", "Horvath"];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function seedValue(column: SqlColumn, row: number, rng: () => number): string | number {
  switch (column.kind) {
    case "id":
      return row + 1;
    case "foreign_id":
      // SKEWED, not uniform. If every parent has the same number of children,
      // then `HAVING COUNT(*) > 3` returns either everything or nothing, and a
      // candidate who omits the HAVING clause entirely still gets the right
      // answer. A skew means some parents clear the threshold and some do not,
      // so the aggregate is actually being tested.
      return FK_SKEW[row % FK_SKEW.length];
    case "date":
      // ~70% inside the last 90 days. Questions say "in the last 90 days"
      // constantly, and a seed with too few recent rows returns an empty grid,
      // which hides a CORRECT query from the candidate.
      return isoDaysAgo(rng() < 0.7 ? Math.floor(rng() * 88) : 91 + Math.floor(rng() * 120));
    case "money":
      return Math.round((15 + rng() * 480) * 100) / 100;
    case "status":
      // ~60% "completed". It is what nearly every WHERE clause filters on, so it
      // must be common, but NOT universal: if every row were "completed", a
      // candidate who forgot the WHERE clause would still pass.
      return row % 5 === 0 || row % 7 === 0 ? STATUSES[1 + (row % 3)] : "completed";
    case "country":
      return COUNTRIES[row % COUNTRIES.length];
    case "category":
      return CATEGORIES[row % CATEGORIES.length];
    case "email":
      return `user${row + 1}@example.com`;
    case "person_name":
      return `${FIRST[row % FIRST.length]} ${LAST[row % LAST.length]}`;
    case "quantity":
      return 1 + Math.floor(rng() * 9);
    case "boolean":
      return row % 4 === 0 ? 0 : 1;
    default:
      return `${column.name}_${row + 1}`;
  }
}

function quote(value: string | number): string {
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildFixtureSql(tables: SqlTable[], rowsPerTable = 32): string {
  const rng = makeRng(20260712);
  const statements: string[] = [];

  for (const table of tables) {
    const cols = table.columns.map((c) => `${c.name} ${sqliteType(c.kind)}`).join(", ");
    statements.push(`DROP TABLE IF EXISTS ${table.name};`);
    statements.push(`CREATE TABLE ${table.name} (${cols});`);

    // A dimension table (one whose own primary id is referenced elsewhere) gets
    // fewer rows, so foreign keys actually resolve.
    // A dimension table (its own id, few columns, no foreign keys) is small, so
    // foreign keys from fact tables always resolve to a real parent row.
    const hasForeignKey = table.columns.some((c) => c.kind === "foreign_id");
    const isDimension = !hasForeignKey && table.columns[0]?.kind === "id" && table.columns.length <= 4;
    const count = isDimension ? 8 : rowsPerTable;

    const values: string[] = [];
    for (let row = 0; row < count; row += 1) {
      values.push(`(${table.columns.map((c) => quote(seedValue(c, row, rng))).join(", ")})`);
    }
    statements.push(
      `INSERT INTO ${table.name} (${table.columns.map((c) => c.name).join(", ")}) VALUES\n  ${values.join(",\n  ")};`,
    );
  }

  return statements.join("\n");
}

/* ──────────────────────────── running queries ─────────────────────────── */

export type SqlResult = {
  ok: boolean;
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  error?: string;
};

export type SqlSandbox = {
  tables: SqlTable[];
  fixtureSql: string;
  /** Human-readable schema, shown to the candidate above the editor. */
  describe(): string;
  run(query: string): SqlResult;
  /**
   * Deterministic PASS/FAIL against a reference query. Both run on the SAME
   * seeded data, so this is real grading, not an LLM's opinion of the text.
   */
  verify(query: string, referenceSolution: string): SqlVerdict;
  close(): void;
};

export type SqlVerdict = {
  status: "pass" | "fail" | "error" | "unverifiable";
  detail: string;
  candidate?: SqlResult;
  expected?: SqlResult;
};

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "\u2205";
  if (typeof value === "number") {
    // Tolerate float noise: SUM(REAL) can differ in the last bits between two
    // algebraically identical queries.
    return (Math.round(value * 1e6) / 1e6).toString();
  }
  return String(value).trim();
}

/**
 * Compare result SETS, not result text.
 *
 * Column ALIASES are ignored: `SUM(total_amount)` and `AS revenue` are the same
 * answer, and failing a candidate for naming a column differently would be
 * nonsense. Row ORDER is only enforced when the reference query has an ORDER BY,
 * because that is the only time order is part of the question.
 */
export function compareResults(candidate: SqlResult, expected: SqlResult, orderSensitive: boolean): SqlVerdict {
  if (!candidate.ok) {
    return { status: "error", detail: candidate.error || "query failed", candidate, expected };
  }
  if (candidate.columns.length !== expected.columns.length) {
    return {
      status: "fail",
      detail: `expected ${expected.columns.length} column(s), got ${candidate.columns.length}`,
      candidate,
      expected,
    };
  }
  if (candidate.rowCount !== expected.rowCount) {
    return {
      status: "fail",
      detail: `expected ${expected.rowCount} row(s), got ${candidate.rowCount}`,
      candidate,
      expected,
    };
  }

  const toKey = (rows: unknown[][]) => rows.map((r) => r.map(normalizeCell).join("\u001f"));
  const got = toKey(candidate.rows);
  const want = toKey(expected.rows);

  if (!orderSensitive) {
    got.sort();
    want.sort();
  }

  for (let i = 0; i < want.length; i += 1) {
    if (got[i] !== want[i]) {
      return {
        status: "fail",
        detail: orderSensitive
          ? `row ${i + 1} does not match the expected result (check your ORDER BY too)`
          : `row ${i + 1} does not match the expected result`,
        candidate,
        expected,
      };
    }
  }

  return { status: "pass", detail: "result set matches the reference solution", candidate, expected };
}

export async function createSqlSandbox(input: {
  /** The question's `context` string, or explicit DDL. */
  context: string;
  /** Optional explicit fixture, overriding the generated one. */
  fixtureSql?: string;
}): Promise<SqlSandbox> {
  const SQL = await loadSqlEngine();
  const tables = parseSchemaFromContext(input.context);
  const fixtureSql = input.fixtureSql || buildFixtureSql(tables);

  const db = new SQL.Database();
  if (fixtureSql.trim()) db.run(fixtureSql);

  const run = (query: string): SqlResult => {
    const sql = String(query || "").trim();
    if (!sql) return { ok: false, columns: [], rows: [], rowCount: 0, error: "empty query" };
    try {
      const out = db.exec(sql);
      const last = out[out.length - 1];
      if (!last) return { ok: true, columns: [], rows: [], rowCount: 0 };
      return { ok: true, columns: last.columns, rows: last.values, rowCount: last.values.length };
    } catch (error) {
      return {
        ok: false,
        columns: [],
        rows: [],
        rowCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  return {
    tables,
    fixtureSql,
    describe() {
      if (!tables.length) return input.context;
      return tables
        .map(
          (t) =>
            `${t.name}(${t.columns.map((c) => `${c.name} ${sqliteType(c.kind)}`).join(", ")})`,
        )
        .join("\n");
    },
    run,
    verify(query, referenceSolution) {
      if (!referenceSolution?.trim()) {
        return { status: "unverifiable", detail: "no reference solution for this question" };
      }
      const expected = run(referenceSolution);
      if (!expected.ok) {
        // The reference query itself is broken. Never fail a candidate for that.
        return { status: "unverifiable", detail: "reference solution failed to run" };
      }
      const orderSensitive = /\border\s+by\b/i.test(referenceSolution);
      return compareResults(run(query), expected, orderSensitive);
    },
    close() {
      db.close();
    },
  };
}

export const __workzoSqlSandboxVersion = "1.0.0";
