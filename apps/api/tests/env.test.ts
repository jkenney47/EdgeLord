import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadEnv } from "../src/config/env.js";

describe("loadEnv", () => {
  it("loads variables from the repo root .env path when provided", () => {
    const directory = mkdtempSync(join(tmpdir(), "edgelord-env-"));
    const envPath = join(directory, ".env");

    writeFileSync(
      envPath,
      [
        "API_PORT=4999",
        "DATABASE_PATH=./tmp.sqlite",
        "ALPACA_API_KEY_ID=test-key",
        "ALPACA_API_SECRET_KEY=test-secret",
        "ALPACA_DATA_FEED=sip"
      ].join("\n")
    );

    try {
      expect(loadEnv({}, envPath)).toMatchObject({
        API_PORT: 4999,
        DATABASE_PATH: "./tmp.sqlite",
        ALPACA_API_KEY_ID: "test-key",
        ALPACA_API_SECRET_KEY: "test-secret",
        ALPACA_DATA_FEED: "sip"
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
