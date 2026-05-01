import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const verify = process.argv.includes("--verify");

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    return `Unable to read ${path}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function planStatus(handoff) {
  const completionMatches = [...handoff.matchAll(/complete through \*\*(.*?)\*\*/g)];
  const current =
    handoff.match(/The plan is current through \*\*(.*?)\*\*/)?.[1] ??
    completionMatches.at(-1)?.[1] ??
    "Unknown current slice";
  const nextImplement = handoff.match(/Implement \*\*(.*?)\*\*/)?.[1];
  const suggestedScope = handoff
    .match(/Suggested scope:\n\n((?:- .+\n?)+)/)?.[1]
    ?.split("\n")
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean)
    .at(0);
  const next = nextImplement ?? suggestedScope ?? "No automatic next slice";

  return { current, next };
}

async function run(command, args) {
  const child = spawn(command, args, { stdio: "inherit" });
  const code = await new Promise((resolve) => {
    child.on("close", resolve);
  });

  if (code !== 0) {
    process.exitCode = typeof code === "number" ? code : 1;
  }
}

const handoff = await readText("docs/CURRENT_HANDOFF.md");
const { current, next } = planStatus(handoff);

console.log("Focused UI workflow");
console.log(`Current: ${current}`);
console.log(`Next: ${next}`);
console.log("Scan: AGENTS.md, docs/CURRENT_HANDOFF.md, and the latest plan tail.");
console.log("Edit: keep capture/chart UI changes scoped to the current slice.");
console.log("Preflight: pnpm test:focused-ui");
console.log("Verify: pnpm workflow:focused-ui -- --verify");
console.log("Browser QA: use the Codex in-app browser only; standalone Playwright smoke is legacy opt-in.");

if (verify) {
  await run("pnpm", ["verify:focused-ui"]);
}
