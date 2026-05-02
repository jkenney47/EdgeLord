#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const checks = [
  ["Data coverage", ["pnpm", "data:coverage"]],
  ["Label integrity", ["pnpm", "labels:integrity"]],
  ["Dataset report", ["pnpm", "research:report"]]
];

const startedAt = new Date();
console.log("EdgeLord Data Status");
console.log("====================");
console.log(`started: ${startedAt.toISOString()}`);
console.log(`api: ${process.env.API_BASE_URL ?? "http://127.0.0.1:4317"}`);

const failures = [];
for (const [name, command] of checks) {
  console.log("");
  console.log(`## ${name}`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    env: process.env,
    shell: false
  });

  if (result.status !== 0) {
    failures.push({ name, status: result.status ?? 1 });
  }
}

console.log("");
console.log("Summary");
if (failures.length === 0) {
  console.log("- All data status checks completed.");
  process.exit(0);
}

for (const failure of failures) {
  console.log(`- ${failure.name} failed with exit code ${failure.status}.`);
}
process.exit(1);
