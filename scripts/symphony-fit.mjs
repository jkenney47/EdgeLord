#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const outputDirArg = process.argv.find((arg) =>
  arg.startsWith("--output-dir="),
);
const outputDir = path.resolve(
  repoRoot,
  outputDirArg?.split("=").slice(1).join("=") ||
    `artifacts/symphony-fit/${new Date().toISOString().replaceAll(":", "-")}`,
);

const checks = [
  {
    id: "linear_tracking",
    label: "Linear tracking workflow",
    paths: ["AGENTS.md", ".agents/skills/linear-symphony-tracking/SKILL.md"],
    required: ["Linear", "proof-of-work", "archive"],
  },
  {
    id: "repo_workflow",
    label: "Repo workflow contract",
    paths: ["AGENTS.md", ".agents/skills/edgelord-minimal-labeler/SKILL.md"],
    required: ["minimal", "labeler", "pnpm slice:minimal-labeler"],
  },
  {
    id: "validation_surface",
    label: "Validation surface",
    paths: ["package.json", "scripts/minimal-labeler-workflow.mjs"],
    required: ["verify", "slice:minimal-labeler", "data:status"],
  },
  {
    id: "data_integrity",
    label: "Data and label integrity",
    paths: [
      "AGENTS.md",
      "scripts/label-integrity.mjs",
      "scripts/data-status.mjs",
    ],
    required: ["labels:integrity", "data:status", "replace"],
  },
];

function readIfExists(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch {
    return "";
  }
}

function evaluateCheck(check) {
  const haystack = check.paths.map(readIfExists).join("\n");
  const missing = check.required.filter((term) => !haystack.includes(term));
  return {
    ...check,
    status: missing.length === 0 ? "covered" : "partial",
    missing,
  };
}

const results = checks.map(evaluateCheck);
const recommendation = results.every((result) => result.status === "covered")
  ? "linear_tracker_patterns_only"
  : "tighten_repo_workflow_before_more_symphony";

const report = {
  generatedAt: new Date().toISOString(),
  repository: "EdgeLord",
  noFetch: args.has("--no-fetch"),
  recommendation,
  summary:
    "Use Symphony as a reference pattern for Linear handoffs and proof-of-work. Do not add the Symphony daemon or Elixir runtime unless manual issue tracking becomes a proven bottleneck.",
  results,
};

const markdown = `# EdgeLord Symphony Fit

Generated: ${report.generatedAt}

## Recommendation

${report.summary}

Decision: \`${recommendation}\`

## Checks

${results
  .map((result) => {
    const missing =
      result.missing.length === 0
        ? "None"
        : result.missing.map((item) => `\`${item}\``).join(", ");
    return `### ${result.label}

- Status: \`${result.status}\`
- Paths: ${result.paths.map((item) => `\`${item}\``).join(", ")}
- Missing terms: ${missing}`;
  })
  .join("\n\n")}

## Boundary

- Linear tracks issue state, blockers, PR links, and handoffs.
- EdgeLord repo scripts, tests, label exports, and data reports remain implementation truth.
- Codex goals track the active run.
- No Symphony daemon, Elixir runtime, or root \`WORKFLOW.md\` by default.
`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(path.join(outputDir, "report.md"), markdown);
console.log(`Wrote ${path.relative(repoRoot, outputDir)}/report.md`);
