import type {
  BenchmarkOfficialEntrant,
  BenchmarkOfficialEntrantStatus,
  BenchmarkOfficialOverview,
  BenchmarkSummary,
} from "@ngriffin_uk/polychat-schemas";

export type OfficialFilter = "all" | "missing" | "active" | "failed" | "completed" | "unavailable";

export const OFFICIAL_FILTERS: readonly { id: OfficialFilter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "missing", label: "To run" },
  { id: "active", label: "In the queue" },
  { id: "failed", label: "Failed" },
  { id: "completed", label: "Finished" },
  { id: "unavailable", label: "Cannot run" },
];

export const OFFICIAL_STATUS_LABEL: Record<BenchmarkOfficialEntrantStatus, string> = {
  missing: "To run",
  unavailable: "No key",
  ineligible: "Sits out",
  queued: "Queued",
  running: "Running",
  completed: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
};

export interface OfficialModelRow {
  modelId: string;
  name: string;
  provider: string;
  cells: Map<string, BenchmarkOfficialEntrant>;
}

export interface OfficialCounts {
  missing: number;
  queued: number;
  running: number;
  failed: number;
  completed: number;
  unavailable: number;
}

export function filterMatches(filter: OfficialFilter, status: BenchmarkOfficialEntrantStatus) {
  switch (filter) {
    case "all":
      return true;
    case "missing":
      return status === "missing" || status === "cancelled";
    case "active":
      return status === "queued" || status === "running";
    case "failed":
      return status === "failed";
    case "completed":
      return status === "completed";
    default:
      return status === "unavailable" || status === "ineligible";
  }
}

export function officialModelRows(overview: BenchmarkOfficialOverview): OfficialModelRow[] {
  const rows = new Map<string, OfficialModelRow>();

  for (const board of overview.boards) {
    for (const entrant of board.entrants) {
      const row = rows.get(entrant.modelId) ?? {
        modelId: entrant.modelId,
        name: entrant.name,
        provider: entrant.provider,
        cells: new Map<string, BenchmarkOfficialEntrant>(),
      };

      row.cells.set(board.benchmark.id, entrant);
      rows.set(entrant.modelId, row);
    }
  }

  return [...rows.values()].sort(
    (left, right) =>
      left.provider.localeCompare(right.provider) || left.name.localeCompare(right.name),
  );
}

export function countOfficialStatuses(overview: BenchmarkOfficialOverview): OfficialCounts {
  const counts: OfficialCounts = {
    missing: 0,
    queued: 0,
    running: 0,
    failed: 0,
    completed: 0,
    unavailable: 0,
  };

  for (const board of overview.boards) {
    for (const entrant of board.entrants) {
      switch (entrant.status) {
        case "missing":
        case "cancelled":
          counts.missing += 1;
          break;
        case "queued":
          counts.queued += 1;
          break;
        case "running":
          counts.running += 1;
          break;
        case "failed":
          counts.failed += 1;
          break;
        case "completed":
          counts.completed += 1;
          break;
        default:
          counts.unavailable += 1;
      }
    }
  }

  return counts;
}

export function rowMatchesFilter(row: OfficialModelRow, filter: OfficialFilter): boolean {
  return [...row.cells.values()].some((entrant) => filterMatches(filter, entrant.status));
}

export function missingBenchmarkIds(
  row: OfficialModelRow,
  benchmarks: readonly BenchmarkSummary[],
): BenchmarkSummary["id"][] {
  return benchmarks.flatMap((benchmark) => {
    const status = row.cells.get(benchmark.id)?.status;

    return status === "missing" || status === "cancelled" ? [benchmark.id] : [];
  });
}

export function failedModelIds(overview: BenchmarkOfficialOverview): string[] {
  return [
    ...new Set(
      overview.boards.flatMap((board) =>
        board.entrants.flatMap((entrant) =>
          entrant.status === "failed" && entrant.credential ? [entrant.modelId] : [],
        ),
      ),
    ),
  ];
}
