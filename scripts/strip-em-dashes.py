#!/usr/bin/env python3
"""
Remove AI-tell em-dashes (—) from user-facing UI copy.

Run from your repo root:  python3 scripts/strip-em-dashes.py

WHAT IT DOES
  - Replaces " — " (spaced em-dash, used as a sentence connector) with ", "
  - Replaces any remaining bare "—" with " - "
  - Scope: .tsx files under app/ (EXCLUDING app/api) and components/
    i.e. rendered UI copy only.

WHAT IT DELIBERATELY LEAVES ALONE (so nothing breaks)
  - En-dashes "–" — these are load-bearing in date-range parsing ("2018 – 2020").
  - app/api/** and lib/** — AI prompts, extraction logic, and date parsers may
    rely on dash characters; a blind replace there is risky.
  - .ts (non-tsx) files.

It's idempotent — safe to run repeatedly. Review `git diff` afterward.
"""

import os

EM = "\u2014"  # —
roots = ["app", "components"]
changed_files = 0
changed_chars = 0

for root in roots:
    for dirpath, _, files in os.walk(root):
        # Skip API routes (prompts / server logic).
        if dirpath == os.path.join("app", "api") or dirpath.startswith(os.path.join("app", "api") + os.sep):
            continue
        for fname in files:
            if not fname.endswith(".tsx"):
                continue
            path = os.path.join(dirpath, fname)
            try:
                text = open(path, encoding="utf-8").read()
            except (UnicodeDecodeError, OSError):
                continue
            if EM not in text:
                continue
            count = text.count(EM)
            new = text.replace(f" {EM} ", ", ").replace(EM, " - ")
            open(path, "w", encoding="utf-8").write(new)
            changed_files += 1
            changed_chars += count
            print(f"  {count:3}  {path}")

print(f"\nDone: removed {changed_chars} em-dashes across {changed_files} UI files.")
print("En-dashes (–) in date ranges were left untouched. Review with `git diff`.")
