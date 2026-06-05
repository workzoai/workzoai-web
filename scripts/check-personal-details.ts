/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const blockedPatterns = [
  /haritha/gi,
  /vijayakumar/gi,
  /harithavj/gi,
  /harithavijayakumar/gi,
  /harithavj30@gmail\.com/gi,
  /zweierweg/gi,
];

const allowedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".sql",
  ".env",
  ".example",
]);

const ignoredDirs = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".vercel",
]);

function walk(dir: string, files: string[] = []) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (!ignoredDirs.has(item)) walk(full, files);
      continue;
    }

    if (allowedExtensions.has(path.extname(item)) || item.includes(".env")) {
      files.push(full);
    }
  }

  return files;
}

let found = false;

for (const file of walk(ROOT)) {
  const content = fs.readFileSync(file, "utf8");

  for (const pattern of blockedPatterns) {
    pattern.lastIndex = 0;
    const matches = content.match(pattern);
    if (matches?.length) {
      found = true;
      console.error(`Personal detail found in ${path.relative(ROOT, file)}: ${matches.join(", ")}`);
    }
  }
}

if (found) {
  console.error("\\nRemove personal founder details before production.");
  process.exit(1);
}

console.log("No personal founder details found.");
