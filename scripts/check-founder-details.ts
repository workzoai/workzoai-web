/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const blocked = [/haritha/gi, /vijayakumar/gi, /harithavj/gi, /harithavj30@gmail\.com/gi];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".sql"]);
const ignoredDirs = new Set(["node_modules", ".next", ".git", "dist", "build", ".vercel"]);

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (!ignoredDirs.has(entry)) walk(full, files);
      continue;
    }

    if (allowedExtensions.has(path.extname(entry))) files.push(full);
  }

  return files;
}

let found = false;

for (const file of walk(root)) {
  const content = fs.readFileSync(file, "utf8");

  for (const pattern of blocked) {
    pattern.lastIndex = 0;
    const matches = content.match(pattern);
    if (matches?.length) {
      found = true;
      console.error(`${path.relative(root, file)}: ${matches.join(", ")}`);
    }
  }
}

if (found) {
  console.error("\\nFounder personal details found. Remove before production.");
  process.exit(1);
}

console.log("No founder personal details found.");
