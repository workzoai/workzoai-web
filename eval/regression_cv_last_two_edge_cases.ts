import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";
import { resolveHeadline } from "../lib/workzoCvCanonicalBuilder";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const name = resolveAuthoritativeCvName({
  rawText: [
    "D A N I M A R T I N E Z",
    "G R A P H I C D E S I G N E R",
    "SKILLS",
    "Creativity",
  ].join("\n"),
  parserName: "Arowwai Industries",
  currentName: "",
  fileName: "Untitled design (6).pdf",
  email: "hello@reallygreatsite.com",
});

assert(name.name === "Dani Martinez", `Expected Dani Martinez, received ${name.name || "<blank>"}`);
assert(name.source === "decorative_header", `Expected decorative_header, received ${name.source}`);
assert(name.needsConfirmation === false, "Recovered decorative name must not require confirmation");

const headline = resolveHeadline({
  parserHeadline: "Graphic Designer 2026",
  forbidden: new Set<string>(),
});

assert(headline.headline === "Graphic Designer", `Expected Graphic Designer, received ${headline.headline || "<blank>"}`);
assert(headline.source === "parser", `Expected parser source, received ${headline.source}`);

// Guard: a year-only or non-role value must not become a headline.
const invalid = resolveHeadline({ parserHeadline: "Portfolio 2026", forbidden: new Set<string>() });
assert(invalid.headline === "", "Non-role year suffix must remain rejected");

console.log("PASS final two CV edge cases");
