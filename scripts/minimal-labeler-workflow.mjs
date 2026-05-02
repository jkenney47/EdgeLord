#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

function output(command, commandArgs) {
  return execFileSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8"
  }).trim();
}

function scanProceedContext() {
  console.log("EdgeLord Proceed Scan");
  console.log("====================");
  console.log(output("git", ["status", "--short", "--branch"]));
  console.log("");
  console.log("Recent checkpoints");
  console.log(output("git", ["log", "--oneline", "-5"]));
  console.log("");
  console.log("Default next-slice order");
  console.log("1. data/import safety");
  console.log("2. label integrity");
  console.log("3. exports");
  console.log("4. research reports");
  console.log("5. Pine scaffold");
  console.log("6. UI only when visible behavior changed or the user asks");
  console.log("");
}

async function isApiRunning(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function apiSmoke() {
  const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
  const checks = [
    ["/health", (body) => body.ok === true],
    ["/labels", (body) => Array.isArray(body.labels)],
    ["/trades", (body) => Array.isArray(body.trades)],
    ["/state/dataset", (body) => body.version === "edgelord.dataset_pulse.v1" && Array.isArray(body.targets)],
    ["/export/schema.json", (body) => body.version === "edgelord.export_schema.v1" && Array.isArray(body.features)]
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
  if (!csv.startsWith("label_id,label_source,capture_mode,action,target_entry,target_exit,target_skip,target_invalid,ticker,timeframe,timestamp")) {
    throw new Error("training-features.csv header is unexpected");
  }
  console.log("ok /export/training-features.csv");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(baseUrl, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function postLabel(baseUrl, payload, expectedStatus = 200) {
  const result = await fetchJson(baseUrl, "/labels", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  assert(
    result.response.status === expectedStatus,
    `POST /labels expected ${expectedStatus}, got ${result.response.status}: ${JSON.stringify(result.body)}`
  );
  return result.body;
}

async function deleteLabel(baseUrl, id) {
  const response = await fetch(`${baseUrl}/labels/${id}`, { method: "DELETE" });
  const body = await response.json().catch(() => ({}));
  assert(response.ok, `DELETE /labels/${id} returned ${response.status}`);
  return body;
}

async function patchLabel(baseUrl, id, payload, expectedStatus = 200) {
  const result = await fetchJson(baseUrl, `/labels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  assert(
    result.response.status === expectedStatus,
    `PATCH /labels/${id} expected ${expectedStatus}, got ${result.response.status}: ${JSON.stringify(result.body)}`
  );
  return result.body;
}

async function importCsv(baseUrl, payload, expectedStatus = 200) {
  const result = await fetchJson(baseUrl, "/import/csv", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  assert(
    result.response.status === expectedStatus,
    `POST /import/csv expected ${expectedStatus}, got ${result.response.status}: ${JSON.stringify(result.body)}`
  );
  return result.body;
}

async function waitForApi(baseUrl, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (child.exitCode !== null) {
      throw new Error(`acceptance API exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Keep waiting until the server is ready or the timeout expires.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for acceptance API");
}

function startAcceptanceApi(port, dbPath) {
  const child = spawn("pnpm", ["--filter", "@edgelord/api", "exec", "tsx", "src/server.ts"], {
    cwd: root,
    env: {
      ...process.env,
      API_PORT: String(port),
      EDGELORD_DB_PATH: dbPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return { child, getOutput: () => output };
}

async function runAcceptance() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "edgelord-acceptance-"));
  const dbPath = path.join(tempDir, "acceptance.sqlite");
  const port = 4400 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const api = startAcceptanceApi(port, dbPath);

  try {
    await waitForApi(baseUrl, api.child);
    console.log(`ok acceptance API ${baseUrl}`);

    const soxlBars = await fetchJson(baseUrl, "/bars?ticker=SOXL&timeframe=4H").then(({ response, body }) => {
      assert(response.ok, `/bars SOXL returned ${response.status}`);
      assert(Array.isArray(body.bars) && body.bars.length >= 3, "SOXL 4H sample bars were not seeded");
      return body.bars;
    });
    const soxsBars = await fetchJson(baseUrl, "/bars?ticker=SOXS&timeframe=4H").then(({ response, body }) => {
      assert(response.ok, `/bars SOXS returned ${response.status}`);
      assert(Array.isArray(body.bars) && body.bars.length >= 2, "SOXS 4H sample bars were not seeded");
      return body.bars;
    });
    console.log("ok seeded SOXL/SOXS bars");

    const entry = await postLabel(baseUrl, {
      labelSource: "retrospective_replay",
      action: "ENTRY",
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: soxlBars[1].timestamp,
      chartPrice: soxlBars[1].close,
      captureMode: "replay",
      visibleUntilTimestamp: soxlBars[1].timestamp
    });
    assert(entry.label.training_eligible === 1, "Replay entry should be training eligible");
    assert(entry.openTrade?.ticker === "SOXL", "SOXL entry should open a SOXL trade");
    console.log("ok entry opens trade");

    const canonicalSkip = await postLabel(baseUrl, {
      labelSource: "retrospective_replay",
      action: "SKIP",
      ticker: "SOXS",
      timeframe: "4H",
      timestamp: soxsBars[0].timestamp,
      chartPrice: soxsBars[0].close + 999,
      captureMode: "replay",
      visibleUntilTimestamp: soxsBars[0].timestamp
    });
    assert(canonicalSkip.label.chart_price === soxsBars[0].close, "Label chart price should come from the stored candle");
    await deleteLabel(baseUrl, canonicalSkip.label.id);
    console.log("ok labels canonicalize chart price");

    const blockedEntry = await postLabel(baseUrl, {
      labelSource: "retrospective_replay",
      action: "ENTRY",
      ticker: "SOXS",
      timeframe: "4H",
      timestamp: soxsBars[0].timestamp,
      chartPrice: soxsBars[0].close,
      captureMode: "replay",
      visibleUntilTimestamp: soxsBars[0].timestamp
    }, 400);
    assert(/Exit open .* trade before entering/i.test(blockedEntry.error ?? ""), "Opposite ticker entry should be blocked by open trade");
    console.log("ok opposite entry blocked");

    const blockedBackdatedExit = await postLabel(baseUrl, {
      labelSource: "retrospective_replay",
      action: "EXIT",
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: soxlBars[0].timestamp,
      chartPrice: soxlBars[0].close,
      captureMode: "replay",
      visibleUntilTimestamp: soxlBars[0].timestamp
    }, 400);
    assert(/before open SOXL entry/i.test(blockedBackdatedExit.error ?? ""), "Backdated exit should be blocked");
    console.log("ok backdated exit blocked");

    const exit = await postLabel(baseUrl, {
      labelSource: "retrospective_replay",
      action: "EXIT",
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: soxlBars[2].timestamp,
      chartPrice: soxlBars[2].close,
      captureMode: "replay",
      visibleUntilTimestamp: soxlBars[2].timestamp
    });
    assert(exit.label.training_eligible === 1, "Replay exit should be training eligible");
    assert(exit.label.parent_entry_label_id === entry.label.id, "Exit should link to entry label");
    assert(exit.openTrade === null, "Exit should close the open trade");
    console.log("ok exit closes trade");

    const skip = await postLabel(baseUrl, {
      labelSource: "retrospective_replay",
      action: "SKIP",
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: soxlBars[0].timestamp,
      chartPrice: soxlBars[0].close,
      captureMode: "replay",
      visibleUntilTimestamp: soxlBars[0].timestamp
    });
    assert(skip.label.training_eligible === 1, "Replay skip should be a training-eligible negative example");
    console.log("ok replay skip is eligible");

    const hindsight = await postLabel(baseUrl, {
      labelSource: "retrospective_hindsight",
      action: "SKIP",
      ticker: "SOXS",
      timeframe: "4H",
      timestamp: soxsBars[1].timestamp,
      chartPrice: soxsBars[1].close,
      captureMode: "regular",
      visibleUntilTimestamp: soxsBars[1].timestamp,
      potentialVisualLeakage: true
    });
    assert(hindsight.label.training_eligible === 0, "Hindsight/future-visible label should not be training eligible");
    console.log("ok hindsight label excluded from training");

    const trades = await fetchJson(baseUrl, "/trades").then(({ response, body }) => {
      assert(response.ok, `/trades returned ${response.status}`);
      assert(body.trades.length === 1, "Expected one paired trade");
      return body.trades;
    });
    assert(trades[0].status === "closed", "Trade should be closed after exit");
    assert(trades[0].exit_label_id === exit.label.id, "Trade should reference exit label");
    console.log("ok paired trade persisted");

    await deleteLabel(baseUrl, exit.label.id);
    const reopened = await fetchJson(baseUrl, "/state/open-trade").then(({ response, body }) => {
      assert(response.ok, `/state/open-trade returned ${response.status}`);
      return body.openTrade;
    });
    assert(reopened?.ticker === "SOXL", "Undoing the exit should reopen the SOXL trade");
    assert(reopened.exit_label_id === null, "Reopened trade should not keep the deleted exit");
    console.log("ok undo exit rebuilds open trade state");

    const secondExit = await postLabel(baseUrl, {
      labelSource: "retrospective_replay",
      action: "EXIT",
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: soxlBars[2].timestamp,
      chartPrice: soxlBars[2].close,
      captureMode: "replay",
      visibleUntilTimestamp: soxlBars[2].timestamp
    });
    assert(secondExit.label.parent_entry_label_id === entry.label.id, "Second exit should relink to the entry label");
    console.log("ok exit can be recaptured after undo");

    const patchedSkip = await patchLabel(baseUrl, secondExit.label.id, { action: "SKIP" });
    assert(patchedSkip.label.trade_id === null, "Patching exit to skip should clear the label trade id");
    assert(patchedSkip.label.parent_entry_label_id === null, "Patching exit to skip should clear the parent entry link");
    const reopenedAfterPatch = await fetchJson(baseUrl, "/state/open-trade").then(({ response, body }) => {
      assert(response.ok, `/state/open-trade returned ${response.status}`);
      return body.openTrade;
    });
    assert(reopenedAfterPatch?.ticker === "SOXL", "Patching exit to skip should reopen the trade");
    console.log("ok patch exit to skip rebuilds trade state");

    const blockedPatchEntry = await patchLabel(baseUrl, patchedSkip.label.id, { action: "ENTRY" }, 404);
    assert(/would enter .* while .* is still open/i.test(blockedPatchEntry.error ?? ""), "Patching skip to entry should not create overlapping trades");
    console.log("ok patch cannot create overlapping entry state");

    const patchedExit = await patchLabel(baseUrl, secondExit.label.id, { action: "EXIT" });
    assert(patchedExit.label.trade_id === entry.label.trade_id, "Patching skip back to exit should relink the trade id");
    assert(patchedExit.label.parent_entry_label_id === entry.label.id, "Patching skip back to exit should relink the parent entry");
    const closedAfterPatch = await fetchJson(baseUrl, "/state/open-trade").then(({ response, body }) => {
      assert(response.ok, `/state/open-trade returned ${response.status}`);
      return body.openTrade;
    });
    assert(closedAfterPatch === null, "Patching skip back to exit should close the trade again");
    console.log("ok patch skip back to exit rebuilds trade state");

    const labelsCsv = await fetch(`${baseUrl}/export/labels.csv`).then((response) => response.text());
    assert(labelsCsv.startsWith("id,label_source,training_eligible,action"), "labels.csv header is unexpected");
    assert(labelsCsv.includes("retrospective_hindsight,0,SKIP"), "labels.csv should show excluded hindsight label");
    console.log("ok /export/labels.csv");

    const tradesCsv = await fetch(`${baseUrl}/export/trades.csv`).then((response) => response.text());
    assert(tradesCsv.startsWith("trade_id,ticker,status"), "trades.csv header is unexpected");
    assert(tradesCsv.includes(",SOXL,closed,"), "trades.csv should include the closed SOXL trade");
    console.log("ok /export/trades.csv");

    const trainingCsv = await fetch(`${baseUrl}/export/training-features.csv`).then((response) => response.text());
    const trainingRows = trainingCsv.trim().split("\n");
    assert(trainingRows[0].startsWith("label_id,label_source,capture_mode,action,target_entry,target_exit,target_skip,target_invalid,ticker,timeframe,timestamp"), "training-features.csv header is unexpected");
    assert(trainingRows.length === 4, `Expected 3 training rows plus header, got ${trainingRows.length}`);
    assert(trainingRows[0].includes("execution_price,decision_price"), "training-features.csv should expose execution and decision prices");
    assert(trainingCsv.includes(",ENTRY,1,0,0,0,"), "training-features.csv should include explicit ENTRY target columns");
    assert(trainingCsv.includes(",SKIP,0,0,1,0,"), "training-features.csv should include explicit SKIP target columns");
    assert(!trainingCsv.includes(hindsight.label.id), "training-features.csv should exclude hindsight label");
    assert(!trainingCsv.includes(exit.label.id), "training-features.csv should exclude deleted labels");
    console.log("ok /export/training-features.csv excludes ineligible labels");

    const tradeCandidatesCsv = await fetch(`${baseUrl}/export/trade-candidates.csv`).then((response) => response.text());
    assert(
      tradeCandidatesCsv.startsWith("candidate_id,trade_id,entry_label_id,exit_label_id,action,target_exit,target_hold"),
      "trade-candidates.csv header is unexpected"
    );
    assert(tradeCandidatesCsv.includes("EXIT,1,0"), "trade-candidates.csv should include exit candidate rows for closed trades");
    console.log("ok /export/trade-candidates.csv");

    const labelsJsonl = await fetch(`${baseUrl}/export/labels.jsonl`).then((response) => response.text());
    const jsonlRows = labelsJsonl.trim().split("\n").map((line) => JSON.parse(line));
    assert(jsonlRows.length === 4, "labels.jsonl should include all labels");
    assert(jsonlRows.every((row) => row.features && typeof row.features === "object"), "labels.jsonl should include feature snapshots");
    console.log("ok /export/labels.jsonl");

    const manifest = await fetchJson(baseUrl, "/export/manifest.json").then(({ response, body }) => {
      assert(response.ok, `/export/manifest.json returned ${response.status}`);
      return body;
    });
    assert(manifest.version === "edgelord.export_manifest.v1", "export manifest version is unexpected");
    assert(manifest.files.includes("schema.json"), "export manifest should include schema.json");
    assert(manifest.labels.trainingEligible === 3, "export manifest should count training-eligible labels");
    assert(manifest.labels.excluded === 1, "export manifest should count excluded labels");
    assert(manifest.trades.byStatus.closed === 1, "export manifest should count closed trades");
    console.log("ok /export/manifest.json");

    const schema = await fetchJson(baseUrl, "/export/schema.json").then(({ response, body }) => {
      assert(response.ok, `/export/schema.json returned ${response.status}`);
      return body;
    });
    assert(schema.version === "edgelord.export_schema.v1", "export schema version is unexpected");
    assert(schema.files["training-features.csv"].targetColumns.includes("target_entry"), "export schema should describe training targets");
    assert(schema.features.some((feature) => feature.column === "feature_close" && feature.pineSupport === "mapped"), "export schema should describe Pine-supported features");
    assert(schema.features.some((feature) => feature.column === "feature_pair_ratio_close" && feature.pineSupport === "research_only"), "export schema should flag research-only features");
    console.log("ok /export/schema.json");

    const datasetPulse = await fetchJson(baseUrl, "/state/dataset").then(({ response, body }) => {
      assert(response.ok, `/state/dataset returned ${response.status}`);
      return body;
    });
    assert(datasetPulse.version === "edgelord.dataset_pulse.v1", "dataset pulse version is unexpected");
    assert(datasetPulse.labels.trainingEligible === 3, "dataset pulse should count training-eligible labels");
    assert(datasetPulse.trades.closed === 1, "dataset pulse should count closed trades");
    assert(datasetPulse.targets.some((target) => target.key === "skips" && target.current === 1), "dataset pulse should include skip target progress");
    console.log("ok /state/dataset");

    await deleteLabel(baseUrl, entry.label.id);
    const orphanState = await fetchJson(baseUrl, "/labels").then(({ response, body }) => {
      assert(response.ok, `/labels returned ${response.status}`);
      return body.labels;
    });
    const orphanExit = orphanState.find((label) => label.id === patchedExit.label.id);
    assert(orphanExit?.trade_id === null, "Deleting an entry should clear dependent exit trade id");
    assert(orphanExit.parent_entry_label_id === null, "Deleting an entry should clear dependent exit parent link");
    assert(orphanExit.training_eligible === 0, "Orphan exit should be excluded from training");
    const tradesAfterEntryDelete = await fetchJson(baseUrl, "/trades").then(({ response, body }) => {
      assert(response.ok, `/trades returned ${response.status}`);
      return body.trades;
    });
    assert(tradesAfterEntryDelete.length === 0, "Deleting an entry should remove the paired trade");
    console.log("ok deleting entry clears dependent exit state");

    const actualEntry = await postLabel(baseUrl, {
      labelSource: "actual_trade",
      action: "ENTRY",
      ticker: "SOXS",
      timeframe: "4H",
      timestamp: soxsBars[0].timestamp,
      chartPrice: soxsBars[0].close,
      executionPrice: 100,
      captureMode: "regular",
      visibleUntilTimestamp: soxsBars[0].timestamp
    });
    assert(actualEntry.label.training_eligible === 1, "Actual entry should be training eligible");
    const actualExit = await postLabel(baseUrl, {
      labelSource: "actual_trade",
      action: "EXIT",
      ticker: "SOXS",
      timeframe: "4H",
      timestamp: soxsBars[1].timestamp,
      chartPrice: soxsBars[1].close,
      executionPrice: 110,
      captureMode: "regular",
      visibleUntilTimestamp: soxsBars[1].timestamp
    });
    assert(actualExit.label.training_eligible === 1, "Actual exit should be training eligible");
    const actualTrades = await fetchJson(baseUrl, "/trades").then(({ response, body }) => {
      assert(response.ok, `/trades returned ${response.status}`);
      return body.trades;
    });
    const actualTrade = actualTrades.find((trade) => trade.entry_label_id === actualEntry.label.id);
    assert(actualTrade?.entry_price === 100, "Actual trade should use execution entry price");
    assert(actualTrade.exit_price === 110, "Actual trade should use execution exit price");
    assert(Math.abs(actualTrade.return_pct - 10) < 0.0001, "Actual trade return should use execution prices");
    console.log("ok actual trade execution prices drive returns");

    const clearedActualExit = await patchLabel(baseUrl, actualExit.label.id, { executionPrice: null, confidence: null, notes: null });
    assert(clearedActualExit.label.execution_price === null, "PATCH should clear nullable execution price");
    assert(clearedActualExit.label.confidence === null, "PATCH should clear nullable confidence");
    assert(clearedActualExit.label.notes === null, "PATCH should clear nullable notes");
    const clearedActualTrades = await fetchJson(baseUrl, "/trades").then(({ response, body }) => {
      assert(response.ok, `/trades returned ${response.status}`);
      return body.trades;
    });
    const clearedActualTrade = clearedActualTrades.find((trade) => trade.entry_label_id === actualEntry.label.id);
    const expectedClearedReturn = ((soxsBars[1].close - 100) / 100) * 100;
    assert(clearedActualTrade?.exit_price === soxsBars[1].close, "Cleared execution exit should fall back to chart price");
    assert(Math.abs(clearedActualTrade.return_pct - expectedClearedReturn) < 0.0001, "Cleared execution exit should recalculate return");
    console.log("ok patch clears nullable label fields");

    const csv = fs.readFileSync(path.join(root, "data", "sample-bars.csv"), "utf8");
    const guardedImport = await importCsv(baseUrl, { csv, replaceBars: true }, 409);
    assert(guardedImport.activeLabels > 0, "Replace-bars guard should report active labels");
    assert(/Refusing to replace bars/i.test(guardedImport.error ?? ""), "Replace-bars guard should explain the refusal");
    console.log("ok replace-bars refuses to strand existing labels");

    const missingBarLabel = await postLabel(baseUrl, {
      labelSource: "retrospective_replay",
      action: "SKIP",
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2099-01-01T14:30:00.000Z",
      chartPrice: 1,
      captureMode: "replay",
      visibleUntilTimestamp: "2099-01-01T14:30:00.000Z"
    }, 400);
    assert(/No SOXL 4H bar exists/i.test(missingBarLabel.error ?? ""), "Missing candle labels should be rejected");
    console.log("ok labels require an existing candle");
  } catch (error) {
    const output = api.getOutput().trim();
    if (output) {
      console.error("\nacceptance API output:");
      console.error(output);
    }
    throw error;
  } finally {
    api.child.kill("SIGTERM");
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const shouldSlice = args.has("--slice");
const shouldCloseout = args.has("--closeout");
const shouldCheckpoint = args.has("--checkpoint") || shouldSlice;
const shouldProceed = args.has("--proceed") || shouldSlice;
const shouldRunAcceptance = args.has("--acceptance") || shouldCloseout || shouldCheckpoint;
const shouldRunApiSmoke = args.has("--api-smoke") || shouldCloseout || shouldCheckpoint;

if (args.has("--reset-db")) {
  for (const file of ["edgelord.sqlite", "edgelord.sqlite-shm", "edgelord.sqlite-wal"]) {
    const target = path.join(root, "data", file);
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      console.log(`removed ${path.relative(root, target)}`);
    }
  }
}

if (shouldProceed) {
  scanProceedContext();
}

if (shouldCloseout || shouldCheckpoint) {
  run("pnpm", ["lint"]);
}

run("pnpm", ["verify"]);

if (shouldRunAcceptance) {
  await runAcceptance();
  run("pnpm", ["research:fixture-check"]);
}

if (shouldRunApiSmoke) {
  const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4317";
  if (await isApiRunning(baseUrl)) {
    await apiSmoke();
  } else if (shouldCloseout) {
    console.log(`skip live API smoke; ${baseUrl} is not running`);
  } else {
    throw new Error(`Live API is not running at ${baseUrl}`);
  }
}

if (shouldCheckpoint) {
  run("pnpm", ["data:status"]);
  console.log("");
  console.log("Checkpoint git status");
  console.log(output("git", ["status", "--short", "--branch"]));
  if (shouldSlice) {
    console.log("");
    console.log("Slice closeout");
    console.log("- Review `git diff --stat` and the changed files.");
    console.log("- Commit/push only a coherent slice; do not add ignored data, exports, or reports.");
    console.log("- Typical closeout: git add <paths> && git commit -m \"<imperative summary>\" && git push");
  }
}
