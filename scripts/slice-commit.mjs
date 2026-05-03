#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const cliArgs = process.argv.slice(2);
if (cliArgs[0] === "--") cliArgs.shift();
const [message, ...files] = cliArgs;

function usage() {
  console.error("Usage: pnpm slice:commit -- \"Commit message\" <file...>");
  console.error("");
  console.error("Runs the full minimal-labeler slice gate, reviews the selected diff, stages only the listed files, commits, pushes, and prints final status.");
}

function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options
  });
}

if (!message || files.length === 0 || message === "--help" || message === "-h") {
  usage();
  process.exit(message === "--help" || message === "-h" ? 0 : 1);
}

if (files.some((file) => file.startsWith("-"))) {
  usage();
  throw new Error("Pass the commit message first, followed by explicit file paths.");
}

run("pnpm", ["slice:minimal-labeler"]);
run("git", ["diff", "--stat"]);
run("git", ["diff", "--", ...files]);
run("git", ["add", ...files]);
run("git", ["commit", "-m", message]);
run("git", ["push"]);
run("git", ["status", "--short", "--branch"]);
