import type {
  BenchmarkCategory,
  BenchmarkEntrant,
  BenchmarkId,
  BenchmarkMetricDefinition,
  BenchmarkRunStatus,
  BenchmarkStanding,
  BenchmarkSummary,
} from "@ngriffin_uk/polychat-schemas";
import { formatBenchmarkScore, formatBenchmarkStanding } from "@ngriffin_uk/polychat-schemas";

export const benchmarkPaths = {
  index: "/benchmarks",
  board: (benchmarkId: BenchmarkId) => `/benchmarks/${benchmarkId}`,
  entrant: (benchmarkId: BenchmarkId, modelId: string) =>
    `/benchmarks/${benchmarkId}/models/${encodeURIComponent(modelId)}`,
  shared: (token: string) => `/benchmarks/shared/${encodeURIComponent(token)}`,
  app: "/chat/apps/benchmarks",
};

export const ARTIFICIAL_ANALYSIS_URL = "https://artificialanalysis.ai/";

export const BLOCK_LINK_CLASS = "no-underline hover:!no-underline";

export interface CategoryTone {
  dot: string;
  text: string;
  ring: string;
  wash: string;
}

export const CATEGORY_TONES: Record<BenchmarkCategory, CategoryTone> = {
  Vision: {
    dot: "bg-accent-sky",
    text: "text-accent-sky",
    ring: "hover:border-accent-sky/50",
    wash: "from-accent-sky/15",
  },
  Creative: {
    dot: "bg-accent-pink",
    text: "text-accent-pink",
    ring: "hover:border-accent-pink/50",
    wash: "from-accent-pink/15",
  },
  Reasoning: {
    dot: "bg-accent-amber",
    text: "text-accent-amber",
    ring: "hover:border-accent-amber/50",
    wash: "from-accent-amber/15",
  },
  Calibration: {
    dot: "bg-accent-emerald",
    text: "text-accent-emerald",
    ring: "hover:border-accent-emerald/50",
    wash: "from-accent-emerald/15",
  },
};

export const RUN_STATUS_LABEL: Record<BenchmarkRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function formatMetric(definition: BenchmarkMetricDefinition, value: number): string {
  switch (definition.format) {
    case "percent":
      return `${Math.round(value * 100)}%`;
    case "km":
      return `${Math.round(value).toLocaleString("en-GB")} km`;
    case "decades":
      return `×${(10 ** value).toFixed(value < 1 ? 1 : 0)}`;
    default:
      return value.toFixed(3);
  }
}

export function formatLatency(latencyMs: number | null): string {
  if (latencyMs === null) {
    return "–";
  }

  return latencyMs >= 60_000
    ? `${(latencyMs / 60_000).toFixed(1)} min`
    : `${(latencyMs / 1000).toFixed(1)}s`;
}

export function standingLabel(
  benchmark: BenchmarkSummary,
  standing: Pick<BenchmarkStanding, "score" | "rating">,
): string {
  return formatBenchmarkStanding(benchmark, standing);
}

export interface StandingReadout {
  primary: string;
  secondary: string | null;
}

export function standingReadout(
  benchmark: BenchmarkSummary,
  standing: Pick<BenchmarkStanding, "score" | "rating">,
): StandingReadout {
  if (benchmark.scoring === "votes") {
    const seed = standing.score ? formatBenchmarkScore(benchmark, standing.score.mean) : null;

    if (standing.rating) {
      return {
        primary: standingLabel(benchmark, standing),
        secondary: `${standing.rating.wins}–${standing.rating.losses}–${standing.rating.ties} from votes`,
      };
    }

    return { primary: "Awaiting votes", secondary: seed ? `Judge seed ${seed}` : null };
  }

  return { primary: standingLabel(benchmark, standing), secondary: null };
}

export function entrantModelId(entrant: BenchmarkEntrant): string | null {
  return entrant.kind === "model" ? entrant.modelId : null;
}

export function rankLabel(standing: Pick<BenchmarkStanding, "rank" | "tied">): string {
  return standing.tied ? `=${standing.rank}` : String(standing.rank);
}

export function standingPosition(standing: BenchmarkStanding): number {
  return standing.rating ? standing.rating.winRate.mean : (standing.score?.mean ?? 0);
}

export function scoringLabel(benchmark: Pick<BenchmarkSummary, "scoring">): string {
  return benchmark.scoring === "votes" ? "People vote" : "Auto-scored";
}
