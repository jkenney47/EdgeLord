import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const candidatePacketOut = mkdtempSync(join(tmpdir(), "edgelord-candidate-packet-"));

const checks = [
  ["pnpm", ["--filter", "@edgelord/api", "test", "--", "tests/schema.test.ts", "tests/labelService.test.ts", "tests/exportRoutes.test.ts", "tests/reviewRoutes.test.ts"]],
  ["pnpm", ["--filter", "@edgelord/web", "test", "--", "src/store/useAppStore.test.ts", "src/components/ToolRail.test.tsx", "src/charts/ChartGrid4H.test.tsx"]],
  ["pnpm", ["--filter", "@edgelord/web", "typecheck"]],
  [
    "python3",
    [
      "-m",
      "py_compile",
      "research/load_dataset.py",
      "research/summarize_labels.py",
      "research/discover_rules.py",
      "research/walkforward_eval.py",
      "research/pair_trades.py",
      "research/human_vs_model_diff.py",
      "research/build_candidate_packet.py"
    ]
  ],
  ["node", ["--check", "scripts/backfill-soxl-soxs.mjs"]],
  ["pnpm", ["backfill:soxl-soxs", "--", "--start", "2011-01-01", "--end", "2011-12-31"]],
  [
    "python3",
    [
      "research/build_candidate_packet.py",
      "research/fixtures/training_features_sample.csv",
      "--out",
      candidatePacketOut
    ]
  ],
  [
    "python3",
    [
      "research/human_vs_model_diff.py",
      "research/fixtures/training_features_sample.csv",
      join(candidatePacketOut, "model_signals.csv")
    ]
  ],
  ["pnpm", ["--filter", "@edgelord/web", "build"]]
];

for (const [command, args] of checks) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1"
    },
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
