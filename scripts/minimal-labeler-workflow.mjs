#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const args = new Set(process.argv.slice(2));

function run(command, commandArgs, options = {}) {
  console.log(`\n$ ${[command, ...commandArgs].join(" ")}`);
  execFileSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
    ...options
  });
}

async function apiSmoke() {
  const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
  const checks = [
    ["/health", (body) => body.ok === true],
    ["/labels", (body) => Array.isArray(body.labels)],
    ["/trades", (body) => Array.isArray(body.trades)]
  ];

  for (const [route, predicate] of checks) {
    const response = await fetch(`${baseUrl}${route}`);
    if (!response.ok) {
      throw new Error(`${route} returned ${response.status}`);
    }
    const body = await response.json();
    if (!predicate(body)) {
      throw new Error(`${route} returned unexpected shape`);
    }
    console.log(`ok ${route}`);
  }

  const csv = await fetch(`${baseUrl}/export/training-features.csv`).then((response) => response.text());
  if (!csv.startsWith("label_id,action,ticker,timeframe,timestamp")) {
    throw new Error("training-features.csv header is unexpected");
  }
  console.log("ok /export/training-features.csv");
}

if (args.has("--reset-db")) {
  for (const file of ["edgelord.sqlite", "edgelord.sqlite-shm", "edgelord.sqlite-wal"]) {
    const target = path.join(root, "data", file);
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      console.log(`removed ${path.relative(root, target)}`);
    }
  }
}

run("pnpm", ["verify"]);

if (args.has("--api-smoke")) {
  await apiSmoke();
}
