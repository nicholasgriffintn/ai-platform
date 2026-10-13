import type {
  BenchmarkEntrant,
  BenchmarkId,
  BenchmarkMetricDefinition,
  BenchmarkStanding,
  BenchmarkSummary,
} from "@ngriffin_uk/polychat-schemas";
import { formatBenchmarkStanding } from "@ngriffin_uk/polychat-schemas";

export const benchmarkPaths = {
  index: "/benchmarks",
  board: (benchmarkId: BenchmarkId) => `/benchmarks/${benchmarkId}`,
  entrant: (benchmarkId: BenchmarkId, modelId: string) =>
    `/benchmarks/${benchmarkId}/models/${encodeURIComponent(modelId)}`,
  shared: (token: string) => `/benchmarks/shared/${encodeURIComponent(token)}`,
  app: "/chat/apps/benchmarks",
};

export const ARTIFICIAL_ANALYSIS_URL = "https://artificialanalysis.ai/";

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

export function standingLabel(
  benchmark: BenchmarkSummary,
  standing: Pick<BenchmarkStanding, "score" | "rating">,
): string {
  return formatBenchmarkStanding(benchmark, standing);
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
