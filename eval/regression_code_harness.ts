/**
 * Run with: npx tsx eval/<this file>
 *
 * NOTE: these suites use node:sqlite (Node 22+) and local python3/node to prove
 * the sandbox and the harness WITHOUT installing sql.js or calling Piston. In
 * production the same logic runs on sql.js in the browser and on /api/code/run.
 * The point is that the grading logic itself is testable in CI, offline.
 */
import { buildPythonHarness, buildJsHarness, readVerdictFromStdout, type InterviewCodeChallenge } from "@/lib/workzoInterviewCodeChallenge";
const { execSync, writeFileSync } = { execSync: require("child_process").execSync, writeFileSync: require("fs").writeFileSync };

const challenge = {
  questionId: "se_code_1", kind: "code", entryPoint: "two_sum",
  tests: [
    { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
    { args: [[3, 2, 4], 6], expected: [1, 2] },
    { args: [[-1, -2, -3, -4], -6], expected: [1, 3], hidden: true },
    { args: [[1, 2], 99], expected: null, hidden: true },
  ],
} as unknown as InterviewCodeChallenge;

const CORRECT_PY = `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return None`;

const BROKEN_PY = `def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return None`;   // bug: allows i == j

const CRASH_PY = `def two_sum(nums, target):
    return nums[999]`;

const NOISY_PY = `def two_sum(nums, target):
    print("debugging: nums =", nums)
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen: return [seen[target - n], i]
        seen[n] = i
    return None`;

const CORRECT_JS = `function two_sum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
  return null;
}`;

function runPy(src: string) { writeFileSync("/tmp/s.py", src); try { return execSync("python3 /tmp/s.py", { encoding: "utf8" }); } catch (e: any) { return (e.stdout || "") + (e.stderr || ""); } }
function runJs(src: string) { writeFileSync("/tmp/s.js", src); try { return execSync("node /tmp/s.js", { encoding: "utf8" }); } catch (e: any) { return (e.stdout || "") + (e.stderr || ""); } }

let fail = 0;
function t(label: string, stdout: string, want: string, wantPassed?: number) {
  const { verdict, cleanStdout } = readVerdictFromStdout(stdout, challenge);
  const ok = verdict.status === want && (wantPassed === undefined || verdict.passed === wantPassed);
  if (!ok) fail++;
  console.log(`  ${ok?"PASS":"FAIL"}  ${label.padEnd(40)} ${verdict.status.padEnd(14)} ${verdict.passed}/${verdict.total}  ${verdict.detail}`);
  if (cleanStdout) console.log(`          candidate's own stdout preserved: ${JSON.stringify(cleanStdout)}`);
}

console.log("\nPYTHON HARNESS");
t("correct solution", runPy(buildPythonHarness(CORRECT_PY, "two_sum", challenge.tests!)), "pass", 4);
t("subtly broken (allows i == j)", runPy(buildPythonHarness(BROKEN_PY, "two_sum", challenge.tests!)), "fail");
t("throws an exception", runPy(buildPythonHarness(CRASH_PY, "two_sum", challenge.tests!)), "fail", 0);
t("candidate prints their own debug", runPy(buildPythonHarness(NOISY_PY, "two_sum", challenge.tests!)), "pass", 4);

console.log("\nJAVASCRIPT HARNESS");
t("correct solution", runJs(buildJsHarness(CORRECT_JS, "two_sum", challenge.tests!)), "pass", 4);
t("wrong function name", runJs(buildJsHarness("function twoSum(a,b){return null}", "two_sum", challenge.tests!)), "fail", 0);

console.log(fail === 0 ? "\nALL HARNESS CHECKS PASSED" : `\n${fail} FAILED`);
