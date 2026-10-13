export const OFFICIAL_BENCHMARK_PROVIDERS: readonly string[] = [
  "anthropic",
  "openai",
  "google-ai-studio",
  "deepseek",
  "moonshot",
  "zai",
  "mistral",
  "grok",
  "minimax",
  "alibaba",
];

export const BENCHMARKS_CONFIG = {
  officialProviders: OFFICIAL_BENCHMARK_PROVIDERS,
  officialMonthlyBudgetUsd: 50,
  officialRunsPerQueuePass: 12,
  personalActiveRuns: 5,
  personalRunsPerDay: 20,
  arenaTokenTtlMs: 2 * 60 * 60 * 1000,
  playTokenTtlMs: 60 * 60 * 1000,
  estimatedInputTokensPerItem: 700,
  estimatedImageTokensPerItem: 1_500,
  estimatedOutputTokensPerItem: 3_000,
} as const;
