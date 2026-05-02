const DEFAULT_API_BASE_URL = "http://127.0.0.1:4317";
const DEFAULT_START_DATE = "2011-01-01";
const DEFAULT_TICKERS = ["SOXL", "SOXS"];
const DEFAULT_TIMEFRAMES = ["1D", "4H", "2H"];

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = {
    apiBaseUrl: process.env.EDGELORD_API_BASE_URL ?? DEFAULT_API_BASE_URL,
    startDate: DEFAULT_START_DATE,
    endDate: todayUtcDate(),
    baseTimeframe: "5Min",
    chunkDelayMs: 750,
    execute: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--") {
      continue;
    }
    if (arg === "--api") {
      args.apiBaseUrl = next;
      index += 1;
      continue;
    }
    if (arg === "--start") {
      args.startDate = next;
      index += 1;
      continue;
    }
    if (arg === "--end") {
      args.endDate = next;
      index += 1;
      continue;
    }
    if (arg === "--base-timeframe") {
      args.baseTimeframe = next;
      index += 1;
      continue;
    }
    if (arg === "--chunk-delay-ms") {
      args.chunkDelayMs = Number(next);
      index += 1;
      continue;
    }
    if (arg === "--execute") {
      args.execute = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(args.endDate)) {
    throw new Error("--start and --end must be YYYY-MM-DD dates");
  }
  if (!["1Min", "5Min"].includes(args.baseTimeframe)) {
    throw new Error("--base-timeframe must be 1Min or 5Min");
  }
  if (!Number.isInteger(args.chunkDelayMs) || args.chunkDelayMs < 0) {
    throw new Error("--chunk-delay-ms must be a non-negative integer");
  }
  if (args.startDate > args.endDate) {
    throw new Error("--start must be before --end");
  }

  return args;
}

function addUtcYears(date, years) {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function yearlyBatches(startDate, endDate) {
  const batches = [];
  let cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    const nextYear = addUtcYears(cursor, 1);
    const batchEnd = new Date(Math.min(addUtcDays(nextYear, -1).getTime(), end.getTime()));
    batches.push({
      startDate: formatDate(cursor),
      endDate: formatDate(batchEnd)
    });
    cursor = addUtcDays(batchEnd, 1);
  }

  return batches;
}

async function postImport(apiBaseUrl, request) {
  const response = await fetch(new URL("/import", apiBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Import failed ${response.status}: ${body}`);
  }

  return response.json();
}

async function fetchCoverage(apiBaseUrl) {
  const url = new URL("/chart/coverage", apiBaseUrl);
  url.searchParams.set("tickers", DEFAULT_TICKERS.join(","));
  url.searchParams.set("timeframes", DEFAULT_TIMEFRAMES.join(","));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Coverage request failed ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function coverageStatus(coverage, targetStartDate, targetEndDate) {
  return coverage.summaries.map((summary) => {
    const firstDate = summary.firstTimestamp?.slice(0, 10) ?? null;
    const lastDate = summary.lastTimestamp?.slice(0, 10) ?? null;
    return {
      ticker: summary.ticker,
      timeframe: summary.timeframe,
      barCount: summary.barCount,
      firstDate,
      lastDate,
      gapCount: summary.gapCount,
      startsAtOrBeforeTarget: Boolean(firstDate && firstDate <= targetStartDate),
      endsAtOrAfterTarget: Boolean(lastDate && lastDate >= targetEndDate)
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batches = yearlyBatches(args.startDate, args.endDate);

  console.log(
    JSON.stringify(
      {
        mode: args.execute ? "execute" : "dry-run",
        apiBaseUrl: args.apiBaseUrl,
        tickers: DEFAULT_TICKERS,
        baseTimeframe: args.baseTimeframe,
        chunkDelayMs: args.chunkDelayMs,
        startDate: args.startDate,
        endDate: args.endDate,
        batchCount: batches.length,
        batches
      },
      null,
      2
    )
  );

  if (!args.execute) {
    console.log("Dry run only. Re-run with --execute to write imported bars into the local database.");
    return;
  }

  for (const batch of batches) {
    const result = await postImport(args.apiBaseUrl, {
      tickers: DEFAULT_TICKERS,
      startDate: batch.startDate,
      endDate: batch.endDate,
      baseTimeframe: args.baseTimeframe,
      chunkDelayMs: args.chunkDelayMs
    });
    console.log(
      JSON.stringify(
        {
          batch,
          importRunId: result.importRunId,
          baseBarsInserted: result.baseBarsInserted,
          aggregatedBarsInserted: result.aggregatedBarsInserted,
          warnings: result.warnings
        },
        null,
        2
      )
    );
  }

  const coverage = await fetchCoverage(args.apiBaseUrl);
  console.log(JSON.stringify({ coverage: coverageStatus(coverage, args.startDate, args.endDate) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
