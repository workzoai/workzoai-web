/**
 * Run with: npx tsx eval/<this file>
 *
 * NOTE: these suites use node:sqlite (Node 22+) and local python3/node to prove
 * the sandbox and the harness WITHOUT installing sql.js or calling Piston. In
 * production the same logic runs on sql.js in the browser and on /api/code/run.
 * The point is that the grading logic itself is testable in CI, offline.
 */
import { parseSchemaFromContext, buildFixtureSql, compareResults, type SqlResult } from "@/lib/workzoSqlSandbox";
const { DatabaseSync } = require("node:sqlite");

const CTX = "Table: orders(order_id INT, customer_id INT, order_date DATE, total_amount DECIMAL, status VARCHAR)";
const REF = "SELECT customer_id, SUM(total_amount) AS revenue FROM orders WHERE status = 'completed' GROUP BY customer_id ORDER BY revenue DESC";

const db = new DatabaseSync(":memory:");
for (const s of buildFixtureSql(parseSchemaFromContext(CTX)).split(";").map((x) => x.trim()).filter(Boolean)) db.exec(s + ";");

function run(sql: string): SqlResult {
  try {
    const rows = db.prepare(sql).all() as Record<string, unknown>[];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { ok: true, columns, rows: rows.map((r) => columns.map((c) => r[c])), rowCount: rows.length };
  } catch (e: any) { return { ok: false, columns: [], rows: [], rowCount: 0, error: e.message }; }
}
const expected = run(REF);
const orderSensitive = /\border\s+by\b/i.test(REF);

let fail = 0;
function t(label: string, sql: string, want: string) {
  const v = compareResults(run(sql), expected, orderSensitive);
  const ok = v.status === want;
  if (!ok) fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)} ${v.status.padEnd(6)} ${v.status !== "pass" ? "(" + v.detail + ")" : ""}`);
}

console.log("\nGRADING: correct answers must PASS, however they are written");
t("the reference itself", REF, "pass");
t("different alias name", "SELECT customer_id, SUM(total_amount) AS total FROM orders WHERE status='completed' GROUP BY customer_id ORDER BY total DESC", "pass");
t("lowercase keywords, different whitespace", "select customer_id,   sum(total_amount)\nfrom orders\nwhere status = 'completed'\ngroup by 1 order by 2 desc", "pass");
t("no alias at all", "SELECT customer_id, SUM(total_amount) FROM orders WHERE status='completed' GROUP BY customer_id ORDER BY 2 DESC", "pass");

console.log("\nGRADING: real mistakes must FAIL");
t("forgot WHERE status='completed'", "SELECT customer_id, SUM(total_amount) r FROM orders GROUP BY customer_id ORDER BY r DESC", "fail");
t("forgot ORDER BY (question asked for it)", "SELECT customer_id, SUM(total_amount) r FROM orders WHERE status='completed' GROUP BY customer_id", "fail");
t("used COUNT instead of SUM", "SELECT customer_id, COUNT(total_amount) r FROM orders WHERE status='completed' GROUP BY customer_id ORDER BY r DESC", "fail");
t("ascending instead of descending", "SELECT customer_id, SUM(total_amount) r FROM orders WHERE status='completed' GROUP BY customer_id ORDER BY r ASC", "fail");
t("selected an extra column", "SELECT customer_id, SUM(total_amount) r, COUNT(*) c FROM orders WHERE status='completed' GROUP BY customer_id ORDER BY r DESC", "fail");
t("syntax error", "SELCT customer_id FROM orders", "error");

console.log(fail === 0 ? "\nALL GRADING CHECKS PASSED" : `\n${fail} FAILED`);
