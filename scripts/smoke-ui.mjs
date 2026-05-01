import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const apiDir = fileURLToPath(new URL("../apps/api/", import.meta.url));
const webDir = fileURLToPath(new URL("../apps/web/", import.meta.url));
const apiRequire = createRequire(new URL("../apps/api/package.json", import.meta.url));
const Database = apiRequire("better-sqlite3");
const apiPort = process.env.API_PORT ?? "4317";
const webPort = process.env.WEB_PORT ?? "5173";
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const webBaseUrl = `http://127.0.0.1:${webPort}`;
const children = [];
let tempDir = null;
const smokeCaptureTimestamp = "2024-02-22T14:30:00.000Z";
const smokeCaptureClose = 73.25;
const smokeCaptureNote = "Focused smoke note";
const smokeStartTimestamp = "2024-01-02T14:30:00.000Z";

function smokeBarTimestamp(index, intervalHours = 24) {
  return new Date(new Date(smokeStartTimestamp).getTime() + index * intervalHours * 60 * 60 * 1000).toISOString();
}

function smokeClose(ticker, timeframe, index) {
  const base = ticker === "SOXL" ? 42 : 31;
  const drift = ticker === "SOXL" ? 0.24 : -0.08;
  const timestamp = smokeBarTimestamp(index, timeframe === "2H" ? 12 : 24);
  if (ticker === "SOXL" && timeframe === "4H" && timestamp === smokeCaptureTimestamp) {
    return smokeCaptureClose;
  }

  return Number((base + index * drift + Math.sin(index / 6) * 1.8).toFixed(2));
}

function spawnServer(name, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0 && signal !== "SIGTERM") {
      process.stderr.write(`[${name}] exited with code ${code}\n`);
    }
  });
  children.push(child);
  return child;
}

async function waitForUrl(url, timeoutMs = 20_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function stopChildren() {
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }

      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve(undefined);
        }, 2_000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve(undefined);
        });
      });
    })
  );
}

async function postJson(path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function seedSmokeBars(databasePath) {
  const db = new Database(databasePath);
  const insert = db.prepare(`
    insert into aggregated_bars (
      ticker,
      timeframe,
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      source_bar_count,
      created_at
    ) values (
      @ticker,
      @timeframe,
      @timestamp,
      @open,
      @high,
      @low,
      @close,
      @volume,
      @sourceBarCount,
      @createdAt
    )
    on conflict(ticker, timeframe, timestamp) do update set
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      volume = excluded.volume,
      source_bar_count = excluded.source_bar_count
  `);
  const createdAt = new Date().toISOString();
  const timeframes = [
    { timeframe: "1D", sourceBarCount: 390, intervalHours: 24 },
    { timeframe: "4H", sourceBarCount: 240, intervalHours: 24 },
    { timeframe: "2H", sourceBarCount: 120, intervalHours: 12 }
  ];
  const tickers = [
    { ticker: "SOXL", base: 42, drift: 0.24 },
    { ticker: "SOXS", base: 31, drift: -0.08 }
  ];
  const transaction = db.transaction(() => {
    for (const { timeframe, sourceBarCount, intervalHours } of timeframes) {
      for (const { ticker, base, drift } of tickers) {
        for (let index = 0; index < 130; index += 1) {
          const timestamp = smokeBarTimestamp(index, intervalHours);
          const wave = Math.sin(index / 6) * 1.8;
          const close =
            ticker === "SOXL" && timeframe === "4H" && timestamp === smokeCaptureTimestamp
              ? smokeCaptureClose
              : Number((base + index * drift + wave).toFixed(2));
          const open = Number((close - 0.35 + Math.cos(index / 5) * 0.2).toFixed(2));
          const high = Number((Math.max(open, close) + 1.15).toFixed(2));
          const low = Number((Math.min(open, close) - 1.05).toFixed(2));

          insert.run({
            ticker,
            timeframe,
            timestamp,
            open,
            high,
            low,
            close,
            volume: 1_000_000 + index * 8_000,
            sourceBarCount,
            createdAt
          });
        }
      }
    }
  });

  transaction();
  db.close();
}

async function seedSmokeLabel() {
  const session = await postJson("/sessions", {
    name: "Smoke session",
    tickerFocus: "SOXL",
    timeframeFocus: "4H",
    notes: "Temporary smoke-test session"
  });

  const label = await postJson("/labels", {
    sessionId: session.id,
    timestamp: "2024-01-02T14:30:00.000Z",
    ticker: "SOXL",
    timeframe: "4H",
    labelType: "ENTRY",
    price: 42.5,
    confidence: 4,
    setupQuality: 5,
    reasonCodes: ["trendline_break"],
    notes: "Smoke export label",
    indicatorSnapshot: {
      ticker: "SOXL",
      timeframe: "4H",
      timestamp: "2024-01-02T14:30:00.000Z",
      volume: 1000,
      volumeSma20: 900,
      ema25: 40,
      sma100: 35,
      monthlyVwap: 37.5,
      atr14Rma: 2.25,
      smio: { erg: 0.75, signal: 0.33, oscillator: 0.42 },
      stochRsi: { rsi: 61, stoch: 75, k: 70, d: 65 },
      cmWvf: {
        wvf: 2.5,
        plot: -2.5,
        upperBand: 3,
        rangeHigh: 2.75,
        filtered: true,
        filteredAggressive: false,
        alert1: false,
        alert2: true,
        alert3: true,
        alert4: false
      },
      pairedTicker: {
        ticker: "SOXS",
        candle: {
          timestamp: "2024-01-02T14:30:00.000Z",
          open: 12,
          high: 13,
          low: 11.5,
          close: 12.25,
          volume: 2500
        },
        indicator: {
          smio: { oscillator: -0.12 },
          stochRsi: { k: 25, d: 30 },
          cmWvf: { plot: -7.2, filtered: false, filteredAggressive: true }
        }
      }
    },
    structureSnapshot: {
      recentCandles: [
        { high: 41, low: 39 },
        { high: 43, low: 40 }
      ],
      recentHigh: 43,
      recentLow: 39,
      distanceToRecentHigh: 0.5,
      distanceToRecentLow: 3.5
    },
    drawingContext: {
      nearestTrendline: {
        id: "smoke-trendline",
        priceAtTimestamp: 42.25,
        slope: 0.05,
        distance: 0.25
      }
    }
  });

  return { session, label };
}

async function assertDesktopWorkstation(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(webBaseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "EdgeLord" }).waitFor();
  await page.getByRole("button", { name: "Regular" }).waitFor();
  await page
    .locator('[aria-label="Replay mode controls"]')
    .getByRole("button", { name: "Replay", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "CSV" }).waitFor();
  await page.getByRole("link", { name: "JSON" }).waitFor();
  await page.waitForFunction(() => {
    const csvLink = document.querySelector('a[href*="format=csv"]');
    return csvLink?.getAttribute("aria-disabled") === "false";
  });
  await page.getByRole("region", { name: /Synchronized .* chart grid/ }).waitFor();
  await page.getByRole("complementary", { name: "Decision capture panel" }).waitFor();
  await page.getByRole("complementary", { name: "Session management" }).waitFor();
  const reviewPanel = page.getByRole("complementary", { name: "Review dashboard" });
  await reviewPanel.waitFor();
  const qaReview = reviewPanel.getByLabel("Actionable QA issue queue");
  if (!(await qaReview.isVisible().catch(() => false))) {
    await reviewPanel.locator("summary").click();
  }
  await reviewPanel.getByLabel("Actionable QA issue queue").waitFor();
  await reviewPanel.getByRole("button", { name: "Warnings" }).click();
  await reviewPanel.getByLabel("Actionable QA issue queue").getByText(/warning/i).first().waitFor();
}

async function assertFocusedCaptureWorkflow(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(webBaseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "EdgeLord" }).waitFor();

  await page
    .getByRole("region", { name: "SOXL 4H chart" })
    .getByRole("button", { name: "Focus SOXL 4H chart panel" })
    .click();
  await page.getByLabel("Focused layout: SOXL 4H").waitFor();

  const focusedChart = page.getByLabel("SOXL 4H chart");
  const captureTarget = focusedChart.getByTitle(`${smokeCaptureTimestamp} close ${smokeCaptureClose.toFixed(2)}`);
  await captureTarget.evaluate((element) => {
    element.click();
  });
  await page
    .getByLabel("Selected candle details")
    .getByText(`${smokeCaptureClose.toFixed(2)}`, { exact: false })
    .waitFor();
  const quickSessionHint = page.getByText("First label starts a Quick capture session.");
  if (await quickSessionHint.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Start Session" }).click();
    await quickSessionHint.waitFor({ state: "hidden" });
  }

  await page.getByRole("button", { name: "Entry", exact: true }).click();
  await page.getByText("Created label").waitFor();
  const historyButton = page.getByRole("button", {
    name: `Edit ENTRY SOXL ${smokeCaptureClose.toFixed(2)} 4H`
  });
  await historyButton.waitFor();

  const marker = focusedChart.getByRole("button", {
    name: `Edit ENTRY label SOXL ${smokeCaptureClose.toFixed(2)}`
  });
  await marker.waitFor();
  await marker.click();
  await page.getByRole("region", { name: "Edit captured label" }).waitFor();
  await marker.evaluate((element) => {
    if (!element.classList.contains("selected")) {
      throw new Error("Focused chart label marker did not show selected state");
    }
  });

  const entryButton = page.getByRole("button", { name: "Entry", exact: true });
  if (await entryButton.isEnabled()) {
    throw new Error("Primary capture button stayed enabled while editing a label");
  }

  const captureDetails = page.locator(".capture-details");
  if (!(await captureDetails.evaluate((element) => element.open))) {
    await page.getByText("Details").click();
  }
  await page.getByLabel("Trendline break").check();
  await page.getByLabel("Label notes").fill(smokeCaptureNote);
  await page.locator(".capture-details summary").getByText("1 reasons + notes").waitFor();
  await page.getByRole("button", { name: "Set label type Exit" }).click();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.getByText("Updated label").waitFor();
  await page.getByRole("button", {
    name: `Edit EXIT SOXL ${smokeCaptureClose.toFixed(2)} 4H`
  }).waitFor();

  await page.getByRole("button", { name: "Calculate Outcome" }).click();
  await page.getByText("Calculated outcome").waitFor();

  const labelsResponse = await waitForUrl(`${apiBaseUrl}/export/trade-events?format=json`);
  const labelsExport = await labelsResponse.json();
  if (
    labelsExport.manifest?.schemaVersion !== "trade-events.v1" ||
    labelsExport.manifest?.exportVersion !== "trade-events-export.v1" ||
    !Array.isArray(labelsExport.events)
  ) {
    throw new Error("JSON export did not include the expected versioned manifest");
  }
  const labels = labelsExport.events;
  const focusedLabel = labels.find(
    (label) => label.timestamp === smokeCaptureTimestamp && label.ticker === "SOXL"
  );
  if (!focusedLabel) {
    throw new Error("Focused capture label was missing from JSON export");
  }
  if (
    focusedLabel.labelType !== "EXIT" ||
    focusedLabel.notes !== smokeCaptureNote ||
    !focusedLabel.reasonCodes.includes("trendline_break") ||
    focusedLabel.outcomeAvailable !== true ||
    focusedLabel.outcomeHorizonBars !== 10 ||
    typeof focusedLabel.outcomeFutureReturn1 !== "number"
  ) {
    throw new Error("Focused capture detail edits or outcome calculation did not round-trip through export");
  }

  const exitMarker = focusedChart.getByRole("button", {
    name: `Edit EXIT label SOXL ${smokeCaptureClose.toFixed(2)}`
  });
  await exitMarker.click();

  let failedDeleteOnce = false;
  const deleteFailureRoute = async (route) => {
    if (route.request().method() === "DELETE" && !failedDeleteOnce) {
      failedDeleteOnce = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Smoke delete failure" })
      });
      return;
    }

    await route.continue();
  };
  await page.route(`${apiBaseUrl}/labels/**`, deleteFailureRoute);
  await page.getByRole("button", { name: "Delete Label" }).click();
  const deleteAlert = page.getByRole("alert");
  await deleteAlert.getByText("Error").waitFor();
  await deleteAlert.getByText("Label delete request failed: 500").waitFor();
  await page.getByRole("region", { name: "Edit captured label" }).waitFor();
  const deleteAlertBox = await deleteAlert.boundingBox();
  if (!deleteAlertBox) {
    throw new Error("Focused capture delete error alert was not measurable");
  }
  if (deleteAlertBox.height > 42) {
    throw new Error("Focused capture delete error alert consumed too much vertical space");
  }

  await page.unroute(`${apiBaseUrl}/labels/**`, deleteFailureRoute);
  await page.getByRole("button", { name: "Delete Label" }).click();
  await page.getByText("Deleted label").waitFor();
  await exitMarker.waitFor({ state: "detached" });
}

async function assertNarrowFocusedReviewLoop(page) {
  await page.setViewportSize({ width: 662, height: 900 });
  await page.goto(webBaseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "EdgeLord" }).waitFor();

  await page
    .getByRole("region", { name: "SOXL 4H chart" })
    .getByRole("button", { name: "Focus SOXL 4H chart panel" })
    .click();
  await page.getByLabel("Focused layout: SOXL 4H").waitFor();

  const focusedChart = page.getByLabel("SOXL 4H chart");
  const captureTarget = focusedChart.getByTitle(`${smokeCaptureTimestamp} close ${smokeCaptureClose.toFixed(2)}`);
  await captureTarget.evaluate((element) => {
    element.click();
  });
  await focusedChart.getByLabel(`SOXL selected close ${smokeCaptureClose.toFixed(2)}`).waitFor();

  const priceCandles = focusedChart.getByLabel("Price candles");
  const candleBox = await priceCandles.boundingBox();
  if (!candleBox) {
    throw new Error("Focused chart candle surface was not measurable in narrow viewport");
  }
  await page.mouse.move(candleBox.x + candleBox.width * 0.2, candleBox.y + candleBox.height * 0.42);

  const readouts = focusedChart.getByLabel("SOXL 4H chart readouts");
  await readouts.getByText("Hover").waitFor();
  await readouts.getByText("Selected").waitFor();

  const readoutBox = await readouts.boundingBox();
  const focusButtonBox = await focusedChart.getByRole("button", { name: "Show all chart panels" }).boundingBox();
  if (!readoutBox || !focusButtonBox) {
    throw new Error("Focused chart header controls were not measurable in narrow viewport");
  }
  if (readoutBox.x + readoutBox.width > focusButtonBox.x - 4) {
    throw new Error("Narrow focused chart readouts overlap the chart focus button");
  }

  const readoutTexts = await readouts.locator(".chart-readout strong").evaluateAll((elements) =>
    elements.map((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      text: element.textContent
    }))
  );
  if (readoutTexts.length < 2) {
    throw new Error("Narrow focused chart did not keep both hover and selected readouts visible");
  }
  if (readoutTexts.some((item) => item.clientWidth <= 0 || !item.text)) {
    throw new Error("Narrow focused chart readout text collapsed");
  }

  const smokeCaptureIndex = Math.round(
    (new Date(smokeCaptureTimestamp).getTime() - new Date(smokeStartTimestamp).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  const previousIndex = smokeCaptureIndex - 1;
  const previousTimestamp = smokeBarTimestamp(previousIndex);
  const previousClose = smokeClose("SOXL", "4H", previousIndex);

  await page.keyboard.press("ArrowLeft");
  await focusedChart.getByLabel(`SOXL selected close ${previousClose.toFixed(2)}`).waitFor();
  const compactLabelControls = page.getByRole("group", { name: "Compact label controls" });
  await compactLabelControls.getByRole("button", { name: "Entry" }).waitFor();
  if (!(await compactLabelControls.getByRole("button", { name: "Entry" }).isEnabled())) {
    await page.getByRole("button", { name: "Start Session" }).click();
    await compactLabelControls.getByRole("button", { name: "Entry" }).waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const entry = document.querySelector('[aria-label="Entry"]');
      return entry instanceof HTMLButtonElement && !entry.disabled;
    });
  }
  await compactLabelControls.getByRole("button", { name: "Exit" }).waitFor();
  await compactLabelControls.getByRole("button", { name: "Skip" }).waitFor();
  await compactLabelControls.getByRole("button", { name: "Invalid" }).waitFor();
  await compactLabelControls.getByRole("button", { name: "Confidence 3" }).waitFor();
  await compactLabelControls.getByRole("button", { name: "Setup quality 3" }).waitFor();
  await compactLabelControls.getByText("Details").waitFor();
  await readouts.getByText(new RegExp(`${previousTimestamp.slice(0, 10)} .* C ${previousClose.toFixed(2)}`)).waitFor();

  await page.keyboard.press("KeyE");
  const captureStatus = page.locator(".capture-status").filter({ hasText: "Created label" });
  await captureStatus.getByText("Created label").waitFor();
  await captureStatus.getByText(`ENTRY SOXL ${previousClose.toFixed(2)} 4H`).waitFor();
  const statusBox = await captureStatus.boundingBox();
  if (!statusBox) {
    throw new Error("Narrow focused capture status was not measurable");
  }
  if (statusBox.height > 34) {
    throw new Error("Narrow focused capture status consumed too much vertical space");
  }
  const narrowHistoryButtonVisible = await page
    .getByRole("button", {
      name: `Edit ENTRY SOXL ${previousClose.toFixed(2)} 4H`
    })
    .isVisible()
    .catch(() => false);
  if (narrowHistoryButtonVisible) {
    throw new Error("Narrow capture dock still exposes full label history");
  }
}

async function assertNarrowWorkstation(page) {
  const viewport = { width: 662, height: 900 };
  await page.setViewportSize(viewport);
  await page.goto(webBaseUrl, { waitUntil: "networkidle" });
  await page.getByRole("region", { name: /Synchronized .* chart grid/ }).waitFor();

  const capture = page.getByRole("complementary", { name: "Decision capture panel" });
  await capture.waitFor();
  const captureBox = await capture.boundingBox();
  if (!captureBox) {
    throw new Error("Capture panel was not measurable in narrow viewport");
  }

  const captureBottom = captureBox.y + captureBox.height;
  if (Math.abs(captureBottom - viewport.height) > 2) {
    throw new Error("Capture panel is not pinned to the bottom in narrow viewport");
  }
  if (captureBox.height > 160) {
    throw new Error("Capture panel consumes too much of the narrow viewport");
  }
  const selectedContextVisible = await page
    .getByRole("region", { name: "Selected candle context" })
    .isVisible()
    .catch(() => false);
  if (selectedContextVisible) {
    throw new Error("Narrow capture dock still shows full selected candle context");
  }

  await page.getByRole("complementary", { name: "Session management" }).scrollIntoViewIfNeeded();
  await page
    .getByRole("complementary", { name: "Session management" })
    .locator("summary")
    .click();
  await page.getByLabel("Session name").waitFor();
  await page.getByRole("complementary", { name: "Review dashboard" }).scrollIntoViewIfNeeded();
  const narrowReviewPanel = page.getByRole("complementary", { name: "Review dashboard" });
  if (!(await narrowReviewPanel.getByLabel("Label counts").isVisible().catch(() => false))) {
    await narrowReviewPanel.locator("summary").click();
  }
  await page.getByLabel("Label counts").waitFor();
}

async function main() {
  tempDir = await mkdtemp(join(tmpdir(), "edgelord-smoke-"));
  const databasePath = join(tempDir, "edgelord-smoke.sqlite");

  spawnServer("api", "node", ["--import", "tsx", "src/server.ts"], {
    cwd: apiDir,
    env: {
      ...process.env,
      API_PORT: apiPort,
      DATABASE_PATH: databasePath,
      WEB_ORIGIN: webBaseUrl
    }
  });
  spawnServer("web", "pnpm", ["exec", "vite", "--host", "127.0.0.1", "--port", webPort], {
    cwd: webDir,
    env: {
      ...process.env,
      WEB_PORT: webPort,
      VITE_API_BASE_URL: apiBaseUrl
    }
  });

  await waitForUrl(`${apiBaseUrl}/health`);
  seedSmokeBars(databasePath);
  await waitForUrl(webBaseUrl);
  const seeded = await seedSmokeLabel();

  const csvResponse = await waitForUrl(`${apiBaseUrl}/export/trade-events?format=csv`);
  const csvText = await csvResponse.text();
  if (!csvText.startsWith("schemaVersion,exportVersion,indicatorCalcVersion,structureCalcVersion,id,sessionId,timestamp")) {
    throw new Error("CSV export did not return the expected header");
  }
  if (!csvText.includes("pairedSmioOscillator")) {
    throw new Error("CSV export is missing the paired ETF indicator columns");
  }
  if (!csvText.includes(seeded.label.id) || !csvText.includes("Smoke export label")) {
    throw new Error("CSV export did not include the seeded smoke label");
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await assertDesktopWorkstation(page);
    await assertFocusedCaptureWorkflow(page);
    await assertNarrowFocusedReviewLoop(page);
    await assertNarrowWorkstation(page);

    if (browserErrors.length > 0) {
      throw new Error(`Browser errors:\n${browserErrors.join("\n")}`);
    }
  } finally {
    await browser.close();
  }

  console.log("UI smoke test passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopChildren();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
