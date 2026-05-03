#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const targets = [
  ".agents/skills",
  "README.md",
  "apps",
  "research",
  "scripts"
];

const ignoredPaths = new Set([
  "scripts/hindsight-doctrine-check.mjs"
]);

const checks = [
  {
    name: "replay-safe language",
    pattern: /replay-safe/i,
    message: "Default labeling is hindsight-friendly; avoid replay-safe-only wording."
  },
  {
    name: "replay exit guidance",
    pattern: /when the replay reaches/i,
    message: "Exit guidance should work for chart review, not only replay."
  },
  {
    name: "excluded hindsight CSV fixture",
    pattern: /retrospective_hindsight,0/,
    message: "Hindsight CSV fixture rows should be training-eligible by default."
  },
  {
    name: "excluded hindsight object fixture",
    pattern: /label_source:\s*"retrospective_hindsight"[\s\S]{0,180}training_eligible:\s*0/,
    message: "Hindsight object fixtures should not encode training_eligible: 0."
  },
  {
    name: "hindsight exclusion wording",
    pattern: /(hindsight[^\n]{0,100}excluded|excluded[^\n]{0,100}hindsight)/i,
    message: "Hindsight labels are normal training data unless an explicit filter is requested."
  },
  {
    name: "excluded by default wording",
    pattern: /Excluded by default/,
    message: "No label source should be described as excluded by default."
  }
];

function walk(entry) {
  const absolute = path.join(root, entry);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [entry];
  return fs.readdirSync(absolute).flatMap((name) => {
    if (name === "node_modules" || name === "dist") return [];
    return walk(path.join(entry, name));
  });
}

function isTextFile(file) {
  return /\.(css|js|json|md|mjs|py|ts|tsx)$/.test(file);
}

const failures = [];
for (const file of targets.flatMap(walk).filter(isTextFile)) {
  if (ignoredPaths.has(file)) continue;
  const body = fs.readFileSync(path.join(root, file), "utf8");
  for (const check of checks) {
    const match = check.pattern.exec(body);
    if (!match) continue;
    const line = body.slice(0, match.index).split("\n").length;
    failures.push({ file, line, check });
  }
}

if (failures.length > 0) {
  console.error("EdgeLord hindsight doctrine check failed");
  console.error("=========================================");
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} [${failure.check.name}] ${failure.check.message}`);
  }
  process.exit(1);
}

console.log("ok hindsight doctrine check");
