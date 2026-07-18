import assert from "node:assert/strict";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";

const resolve = (rawText: string) => resolveAuthoritativeCvName({
  rawText,
  parserName: "",
  currentName: "",
  fileName: "resume.pdf",
  email: "",
});

const valid = [
  ["H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T\nlinkedin.com/in/harithavijayakumar30", "Haritha Vijayakumar"],
  ["D A N I M A R T I N E Z\nG R A P H I C D E S I G N E R\nlinkedin.com/in/danimartinez", "Dani Martinez"],
  ["M A R I A R O D R I G U E Z\nPRODUCT MANAGER\nlinkedin.com/in/mariarodriguez", "Maria Rodriguez"],
  ["A H M E D H A S S A N\nSOFTWARE ENGINEER\nlinkedin.com/in/ahmedhassan", "Ahmed Hassan"],
] as const;

for (const [rawText, expected] of valid) {
  const result = resolve(rawText);
  assert.equal(result.name, expected, JSON.stringify(result));
  assert.equal(result.needsConfirmation, false);
}

for (const rawText of [
  "P R O F I L E S U M M A R Y\nlinkedin.com/in/profilesummary",
  "T E C H N I C A L S U P P O R T\nlinkedin.com/in/technicalsupport",
  "A R O W W A I I N D U S T R I E S\nlinkedin.com/in/arowwaiindustries",
  "Address, postal code, City\nYour full name\nJunior Data Scientist\nYour phone contact",
]) {
  const result = resolve(rawText);
  assert.equal(result.name, "", JSON.stringify(result));
  assert.equal(result.needsConfirmation, true);
}

// A plausible parser phrase must not outrank stronger identity evidence printed
// in the top header. This is the production class behind skill/section pairs
// being published as names.
{
  const result = resolveAuthoritativeCvName({
    rawText: "MARCELINE ANDERSON\nGRAPHIC DESIGNER\nPROFILE\nExperienced visual designer",
    parserName: "Design Tools",
    currentName: "",
    fileName: "resume.pdf",
    email: "",
  });
  assert.equal(result.name, "Marceline Anderson", JSON.stringify(result));
  assert.equal(result.source, "top_header");
  assert.equal(result.needsConfirmation, false);
}

// Parser identity remains a safe fallback for sidebar-first layouts where the
// visible top lines begin with section/contact content and no header name can be
// reconstructed.
{
  const result = resolveAuthoritativeCvName({
    rawText: "K O N T A K T\n+49 170 1234567\nB I L D U N G\nMaster of Engineering",
    parserName: "Surender Dillibabu",
    currentName: "",
    fileName: "resume.pdf",
    email: "",
  });
  assert.equal(result.name, "Surender Dillibabu", JSON.stringify(result));
  assert.equal(result.source, "parser");
  assert.equal(result.needsConfirmation, false);
}

console.log("PASS global remaining identity safeguards");
