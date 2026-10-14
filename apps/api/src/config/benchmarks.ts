export const OFFICIAL_BENCHMARK_LABS: readonly string[] = [
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "moonshot",
  "zai",
  "mistral",
  "xai",
  "minimax",
  "qwen",
  "cloudflare",
  "typesafe",
];

export const BENCHMARK_MIRROR_PROVIDER = "workers-ai";

export const BENCHMARKS_CONFIG = {
  officialLabs: OFFICIAL_BENCHMARK_LABS,
  mirrorProvider: BENCHMARK_MIRROR_PROVIDER,
  recentReleaseDays: 183,
  officialMonthlyBudgetUsd: 50,
  officialRunsPerQueuePass: 12,
  itemConcurrency: 6,
  staleRunMinutes: 15,
  personalActiveRuns: 5,
  personalRunsPerDay: 20,
  arenaTokenTtlMs: 2 * 60 * 60 * 1000,
  playTokenTtlMs: 60 * 60 * 1000,
  estimatedInputTokensPerItem: 700,
  estimatedImageTokensPerItem: 1_500,
  estimatedOutputTokensPerItem: 3_000,
} as const;
