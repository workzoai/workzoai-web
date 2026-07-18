/**
 * Regression: auth gating + sign-in funnel wiring.
 *
 *   npx tsx eval/regression_auth_funnel.ts
 *
 * These are STRUCTURAL assertions over the shipped source. The behaviours they
 * protect are cross-file wiring facts (a gate exists at a door, an event is
 * fired at a choke point, a route no longer exists) that cannot be unit-tested
 * without booting Next + Supabase, but which silently regress the moment
 * someone edits one side of the pair.
 *
 * Each check maps to a real defect found in the codebase:
 *   - /api/interview was an unauthenticated GPT-4o proxy billed to us
 *   - nothing recorded a sign-in, so the funnel could not see the login step
 *   - the interview client handled 403 but not 401, so anonymous users could
 *     run a full voice interview that was never recorded
 *   - the CV upload gate read `isSignedIn === false`, so during auth resolution
 *     (`null`) it showed an uploader that then 401'd
 */
import fs from "fs";
import path from "path";

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const exists = (p: string) => fs.existsSync(path.join(process.cwd(), p));

/* === 1. The unauthenticated GPT-4o proxy is gone ======================== */
check("proxy:deleted", !exists("app/api/interview/route.ts"),
  "app/api/interview/route.ts still exists — it is an open GPT-4o gateway");

check("proxy:secured_sibling_survives",
  exists("app/api/interview/vapi-llm/chat/completions/route.ts"),
  "the SECURED vapi-llm route must remain");

{
  const src = read("app/api/interview/vapi-llm/chat/completions/route.ts");
  check("proxy:sibling_still_gated", /authorizeVapiCaller|VAPI_CUSTOM_LLM_SECRET/.test(src));
  check("proxy:sibling_fails_closed", /if \(!expected\)[\s\S]{0,120}return false/.test(src),
    "an unset secret must reject, not silently reopen the hole");
}

/* === 2. Sign-in is recorded at every choke point ======================== */
{
  const helper = read("lib/workzoServerUsageEvent.ts");
  check("signin:helper_exists", /export async function recordWorkZoSignIn/.test(helper));
  check("signin:writes_sign_in_event", /eventName:\s*"sign_in"/.test(helper));
  check("signin:writes_usage_events_table", /workzo_usage_events/.test(helper),
    "must write the SAME table the dashboard reads");
  check("signin:never_throws", /catch\s*\(error\)\s*\{[\s\S]{0,120}console\.error/.test(helper),
    "analytics must not be able to break auth");

  // The login page offers ONLY signInWithOtp and signInWithOAuth, so callback +
  // confirm are the complete set of session-establishing routes.
  const login = read("app/login/page.tsx");
  check("signin:login_uses_only_otp_and_oauth",
    /signInWithOtp/.test(login) && /signInWithOAuth/.test(login) &&
    !/signInWithPassword/.test(login),
    "a new sign-in method was added — it must also call recordWorkZoSignIn");

  for (const route of ["app/auth/callback/route.ts", "app/auth/confirm/route.ts"]) {
    const src = read(route);
    check(`signin:${route}:imports_recorder`, /recordWorkZoSignIn/.test(src));
    check(`signin:${route}:fires_after_success`, /await recordWorkZoSignIn\(/.test(src));
    check(`signin:${route}:passes_real_user_id`, /userId:\s*\w+\?\.user\?\.id/.test(src),
      "must record the actual authenticated user id, not null");
  }
}

/* === 3. The funnel exposes the sign-in step ============================= */
{
  const api = read("app/api/analytics/route.ts");
  check("funnel:derives_signIns", /const signIns = Math\.max\(/.test(api));
  check("funnel:counts_sign_in_event", /counts\.sign_in/.test(api));
  check("funnel:stage_present", /\{ stage: "Sign-ins", count: signIns \}/.test(api));

  // Order matters: Page views -> Sign-ins -> CV uploads.
  const pv = api.indexOf('{ stage: "Page views"');
  const si = api.indexOf('{ stage: "Sign-ins"');
  const cv = api.indexOf('{ stage: "CV uploads"');
  check("funnel:stage_ordering", pv > 0 && si > pv && cv > si,
    `Page views=${pv} Sign-ins=${si} CV uploads=${cv}`);

  check("funnel:signIns_in_summary", (api.match(/^\s+signIns,$/gm) || []).length >= 2,
    "signIns must be exposed in BOTH summary objects the route returns");
}

/* === 4. The KPI is honestly labelled =================================== */
{
  const ui = read("app/founder/FounderAnalyticsClient.tsx");
  check("kpi:relabelled", /label="Active signed-in users"/.test(ui));
  check("kpi:old_label_gone", !/label="Signed-in users"/.test(ui),
    "the misleading label must not survive");
  check("kpi:signins_tile_added", /label="Sign-ins"/.test(ui));
  check("kpi:signins_tile_reads_signIns", /value=\{fmt\(s\.signIns\)\}/.test(ui));
  check("kpi:login_icon_imported", /LogIn,?\s*\n?\}? from "lucide-react"|LogIn,/.test(ui));
  check("kpi:auth_category_allowed", /"system"\s*\|\s*"auth"/.test(ui));
  check("kpi:sign_in_activity_label", /sign_in:\s*\{ title: "Signed in"/.test(ui));
}

/* === 5. CV upload is open to anonymous, but rate limited ================ */
{
  const cv = read("app/api/cv/route.ts");
  check("cv:no_blanket_401",
    !/if \(!resolved\.authenticated\) \{\s*\n\s*return NextResponse\.json\(\{ error: "Unauthorized" \}/.test(cv),
    "the anonymous 401 wall must be gone");
  check("cv:rate_limited", /checkWorkZoRateLimit\(/.test(cv),
    "opening the route without a rate limit recreates the free-AI-gateway hole");
  check("cv:anon_key_is_ip", /cv_parse_anon:\$\{clientIp\}/.test(cv));
  check("cv:signed_in_key_is_user", /cv_parse_user:\$\{resolved\.userId\}/.test(cv));
  check("cv:anon_limit_lower_than_user", /resolved\.authenticated \? 30 : 5/.test(cv));
  check("cv:returns_429", /status: 429/.test(cv));
  check("cv:premium_requires_auth",
    /const isPremium =\s*\n\s*resolved\.authenticated &&/.test(cv),
    "anonymous callers must never receive a paid plan");
  // The canonical-builder refactor must survive this change.
  check("cv:canonical_builder_intact", /buildCanonicalResumeProfile\(/.test(cv));
  check("cv:validator_intact", /validateCanonicalProfile\(/.test(cv));
}

/* === 6. Start Interview mandates sign-in (every door) =================== */
{
  const ob = read("app/onboarding/page.tsx");
  check("onboarding:gate_exists", /function requireSignInToStart\(\): boolean/.test(ob));
  check("onboarding:gate_checks_true_not_falsy", /if \(isSignedIn === true\) return true;/.test(ob),
    "must gate on === true so the unresolved `null` state does NOT pass");
  check("onboarding:persists_before_redirect",
    /try \{ persistFast\(\); \} catch[\s\S]{0,400}router\.push\(`\/login/.test(ob),
    "setup must be saved before the login round trip");
  check("onboarding:redirects_back", /\/login\?redirect=\$\{encodeURIComponent\("\/onboarding"\)\}/.test(ob));

  // All three navigation doors into /interview must gate.
  check("onboarding:gates_startInterview",
    /function startInterview\(\) \{[\s\S]{0,300}requireSignInToStart\(\)/.test(ob));
  check("onboarding:gates_launchInterview",
    /function launchInterview\(\) \{[\s\S]{0,300}requireSignInToStart\(\)/.test(ob));
  check("onboarding:gate_count", (ob.match(/if \(!requireSignInToStart\(\)\) return/g) || []).length >= 3,
    "startInterview, launchInterview and the identity-confirm push must all gate");

  // The upload wall must be gone.
  check("onboarding:upload_wall_removed", !/Sign in to upload<\/a>/.test(ob) &&
    !/Requires an account/.test(ob),
    "anonymous visitors must be able to upload");
}

/* === 7. Server-side backstop: the interview honours 401 ================= */
{
  const iv = read("app/interview/page.tsx");
  check("interview:handles_401", /if \(response\.status === 401\)/.test(iv),
    "a 401 previously fell through to blocked:false and the interview ran anyway");
  check("interview:401_blocks", /blocked: true as const, requiresSignIn: true as const/.test(iv));
  check("interview:401_still_handles_403", /if \(response\.status === 403\)/.test(iv),
    "the quota path must survive");
  // Order matters more than proximity: the requiresSignIn branch must return
  // BEFORE openUpgradeModal is reached, or an anonymous visitor gets a paywall.
  const blockedAt = iv.indexOf("if (sessionPersistResult.blocked)");
  const signInAt = iv.indexOf("requiresSignIn) {", blockedAt);
  const redirectAt = iv.indexOf("/login?redirect=", signInAt);
  const upsellAt = iv.indexOf("openUpgradeModal(gateFeature)", blockedAt);
  check("interview:signin_branch_precedes_upsell",
    blockedAt > 0 && signInAt > blockedAt && upsellAt > signInAt,
    `blocked=${blockedAt} signIn=${signInAt} upsell=${upsellAt}`);
  check("interview:signin_branch_redirects_and_returns",
    redirectAt > signInAt && redirectAt < upsellAt &&
    iv.slice(signInAt, upsellAt).includes("return;"),
    "the sign-in branch must redirect and return before the upgrade modal");
  check("interview:no_undefined_router", !/\brouter\.push\(`\/login/.test(iv),
    "this component has no useRouter — must hard-navigate");
  check("interview:hard_navigates", /window\.location\.assign\(`\/login/.test(iv));
}

/* ======================================================================= */
const total = passed + failures.length;
console.log("=".repeat(66));
console.log(`AUTH + FUNNEL REGRESSION: ${passed}/${total} = ${((passed / total) * 100).toFixed(1)}%`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log(`  \u2717 ${f}`);
}
console.log("=".repeat(66));
process.exit(failures.length ? 1 : 0);
