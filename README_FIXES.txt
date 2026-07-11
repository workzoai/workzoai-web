WorkZo CV — global fixes v2 (drop-in replacements)
==================================================

Replace these 3 files (paths are repo-relative). No new imports, no signature
changes:

  lib/workzoResumeParser.ts     -> lib/workzoResumeParser.ts
  lib/workzoResumeFactGuard.ts  -> lib/workzoResumeFactGuard.ts
  app/cv/page.tsx               -> app/cv/page.tsx

All fixes are structural and verified against the real Surender CV using your
own parser / generator / guard code. None of them are keyed to a specific CV,
string, or language.


FIX 1 — Editable name hijacked by a section-body phrase
-------------------------------------------------------
lib/workzoResumeParser.ts (extractBasics, workzoExtractNameFromRawCv)

The preview re-parses free text; the name fallback scanned the WHOLE document,
so once the header line stopped being name-shaped it rendered the first 2-word
capitalized phrase it found as the name. For this CV that was a skill ("Team
Collaboration"); for another CV it would be a company or a degree.
Fix: bound every name search to the header block above the first section header.


FIX 2 — Output language ignored (CV stayed in the source language)
------------------------------------------------------------------
lib/workzoResumeFactGuard.ts (guardResumeAgainstSource) + app/cv/page.tsx

The fact-guard rebuilt the CV from the source and only accepted model text that
lexically overlapped it, so a translated rewrite (≈0 token overlap) reverted to
the source language.
Fix: language-aware guard. When outputLanguage differs from the source, keep the
model's translated prose but enforce truthfulness structurally — company,
dates, and institutions stay pinned to the real CV; titles/summary/bullets/
skills/degrees come from the model. Same-language mode is unchanged.
Page wiring: pass outputLanguage into the guard, and for a translated rewrite
feed the guard the model's RAW structured profile (the merge step otherwise
re-imposes source-language titles/education).


FIX 3 — Duplicated / mis-dated education
----------------------------------------
lib/workzoResumeParser.ts (extractEducation, extractDate, cleanDegree) +
lib/workzoResumeFactGuard.ts (repairEducation)

Three root causes, all global:
  a) extractDate only accepted a plain hyphen "-", so European ranges written
     with an en-dash ("2013 – 2016") captured just "2013" and left "– 2016"
     glued to the degree line. Now accepts - – — and to/until/bis.
  b) Education pairing scanned a wide ±window from every degree AND every
     institution line, so degrees paired with the wrong school. Rewritten to
     pair lines SEQUENTIALLY into degree/institution blocks.
  c) Dedupe keyed on the exact date string, so the same degree at the same
     school survived twice when the source repeated it with a different date
     format. Both the parser and the guard now dedupe by degree-level +
     institution and keep the most complete date. The guard-layer dedupe means
     duplicates are collapsed no matter which upstream parser (vision or text)
     produced them.
  d) cleanDegree/cleanInstitution stripped a trailing "Capitalized Capitalized"
     pair, which (once dates parsed correctly) truncated real fields
     ("...Space Science and Technology", "...Aeronautical Engineering"). Removed.


FIX 4 — Translated experience mis-aligned to the wrong company
--------------------------------------------------------------
lib/workzoResumeFactGuard.ts (guardResumeAgainstSource)

Introduced by the language fix: translated titles/bullets were bound to source
entries by POSITION, so if the model returned jobs in a different order a title
landed under the wrong company (e.g. "CAD Designer" under Cummins).
Fix: match model↔source experience by COMPANY (a language-invariant proper
noun), and education by INSTITUTION. Falls back to positional only when no
entity match exists.


Verified
--------
  * single-word / lowercase / different-CV name edits render the edited name,
    never a skill/company/degree
  * German output stays fully German; English output byte-for-byte unchanged
  * education collapses to 3 correctly-paired entries with full ranges and full
    degree names, from both the parser and the guard
  * translated experience aligns to the correct company regardless of model order
  * all three files pass a syntax check

Not touched (pre-existing, separate from the reported issues): the fallback
text parser mis-reads some experience titles/dates on this particular PDF
(bullets dropped, single-year dates). Your production vision extractor parses
experience correctly (it matches your "extracted raw CV"), so this is out of
scope here — happy to fix the text-parser experience path separately if useful.
