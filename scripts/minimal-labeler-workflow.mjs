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
      timestamp: soxlBars[0].timestamp,
      chartPrice: soxlBars[0].close,
      captureMode: "replay",
      visibleUntilTimestamp: soxlBars[0].timestamp
    });
    assert(entry.label.training_eligible === 1, "Replay entry should be training eligible");
    assert(entry.openTrade?.ticker === "SOXL", "SOXL entry should open a SOXL trade");
    console.log("ok entry opens trade");

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

    const exit = await postLabel(baseUrl, {
      labelSource: "retrospective_replay",
      action: "EXIT",
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: soxlBars[1].timestamp,
      chartPrice: soxlBars[1].close,
      captureMode: "replay",
      visibleUntilTimestamp: soxlBars[1].timestamp
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
      timestamp: soxlBars[2].timestamp,
      chartPrice: soxlBars[2].close,
      captureMode: "replay",
      visibleUntilTimestamp: soxlBars[2].timestamp
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
    assert(trainingRows[0].startsWith("label_id,action,ticker,timeframe,timestamp"), "training-features.csv header is unexpected");
    assert(trainingRows.length === 4, `Expected 3 training rows plus header, got ${trainingRows.length}`);
    assert(!trainingCsv.includes(hindsight.label.id), "training-features.csv should exclude hindsight label");
    console.log("ok /export/training-features.csv excludes ineligible labels");

    const labelsJsonl = await fetch(`${baseUrl}/export/labels.jsonl`).then((response) => response.text());
    const jsonlRows = labelsJsonl.trim().split("\n").map((line) => JSON.parse(line));
    assert(jsonlRows.length === 4, "labels.jsonl should include all labels");
    assert(jsonlRows.every((row) => row.features && typeof row.features === "object"), "labels.jsonl should include feature snapshots");
    console.log("ok /export/labels.jsonl");
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

if (args.has("--acceptance")) {
  await runAcceptance();
}
