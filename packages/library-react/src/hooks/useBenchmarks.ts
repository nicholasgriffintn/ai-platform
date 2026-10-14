import { benchmarksService } from "@ngriffin_uk/polychat-library-client";
import type {
  BenchmarkId,
  BenchmarkOfficialOverview,
  BenchmarkRun,
  BenchmarkVisibility,
  BenchmarkVoteRequest,
  QueueOfficialBenchmarkRunsRequest,
  StartBenchmarkRunsRequest,
} from "@ngriffin_uk/polychat-schemas";
import { isActiveBenchmarkRunStatus } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const BENCHMARKS_QUERY_KEY = "benchmarks";

const BOARD_STALE_TIME = 2 * 60 * 1000;
const ACTIVE_RUN_POLL_MS = 5000;

function hasActiveRun(runs: readonly BenchmarkRun[] | undefined): boolean {
  return Boolean(runs?.some((run) => isActiveBenchmarkRunStatus(run.status)));
}

function hasActiveOfficialRun(overview: BenchmarkOfficialOverview | undefined): boolean {
  return Boolean(
    overview?.boards.some((board) =>
      board.entrants.some(
        (entrant) => entrant.run && isActiveBenchmarkRunStatus(entrant.run.status),
      ),
    ),
  );
}

export function useBenchmarkIndex() {
  return useQuery({
    queryKey: [BENCHMARKS_QUERY_KEY, "index"],
    queryFn: () => benchmarksService.index(),
    staleTime: BOARD_STALE_TIME,
  });
}

export function useBenchmarkBoard(benchmarkId: BenchmarkId) {
  return useQuery({
    queryKey: [BENCHMARKS_QUERY_KEY, "board", benchmarkId],
    queryFn: () => benchmarksService.board(benchmarkId),
    staleTime: BOARD_STALE_TIME,
  });
}

export function useBenchmarkEntrant(benchmarkId: BenchmarkId, modelId: string) {
  return useQuery({
    queryKey: [BENCHMARKS_QUERY_KEY, "entrant", benchmarkId, modelId],
    queryFn: () => benchmarksService.entrant(benchmarkId, modelId),
    staleTime: BOARD_STALE_TIME,
  });
}

export function useSharedBenchmarkRun(token: string) {
  return useQuery({
    queryKey: [BENCHMARKS_QUERY_KEY, "shared", token],
    queryFn: () => benchmarksService.shared(token),
  });
}

export function useMyBenchmarkRuns(enabled = true) {
  return useQuery({
    queryKey: [BENCHMARKS_QUERY_KEY, "mine"],
    queryFn: () => benchmarksService.myRuns(),
    enabled,
    refetchInterval: (query) => (hasActiveRun(query.state.data) ? ACTIVE_RUN_POLL_MS : false),
  });
}

export function useBenchmarkRun(runId: string | null) {
  return useQuery({
    queryKey: [BENCHMARKS_QUERY_KEY, "run", runId],
    queryFn: () => benchmarksService.run(runId ?? ""),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const run = query.state.data?.run;

      return run && hasActiveRun([run]) ? ACTIVE_RUN_POLL_MS : false;
    },
  });
}

export function useBenchmarkEstimate() {
  return useMutation({
    mutationFn: (request: StartBenchmarkRunsRequest) => benchmarksService.estimate(request),
  });
}

export function useStartBenchmarkRuns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: StartBenchmarkRunsRequest) => benchmarksService.start(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BENCHMARKS_QUERY_KEY, "mine"] }),
  });
}

export function useShareBenchmarkRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ runId, visibility }: { runId: string; visibility: BenchmarkVisibility }) =>
      benchmarksService.share(runId, visibility),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BENCHMARKS_QUERY_KEY] }),
  });
}

export function useDeleteBenchmarkRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) => benchmarksService.remove(runId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BENCHMARKS_QUERY_KEY, "mine"] }),
  });
}

export function useCancelBenchmarkRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) => benchmarksService.cancel(runId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BENCHMARKS_QUERY_KEY] }),
  });
}

export function useRetryBenchmarkRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) => benchmarksService.retry(runId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BENCHMARKS_QUERY_KEY] }),
  });
}

export function useOfficialBenchmarkOverview(enabled = true) {
  return useQuery({
    queryKey: [BENCHMARKS_QUERY_KEY, "official"],
    queryFn: () => benchmarksService.official(),
    enabled,
    refetchInterval: (query) =>
      hasActiveOfficialRun(query.state.data) ? ACTIVE_RUN_POLL_MS : false,
  });
}

export function useQueueOfficialBenchmarkRuns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: QueueOfficialBenchmarkRunsRequest) =>
      benchmarksService.queueOfficial(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BENCHMARKS_QUERY_KEY] }),
  });
}

export function useArenaPair(benchmarkId: BenchmarkId, enabled: boolean) {
  return useQuery({
    queryKey: [BENCHMARKS_QUERY_KEY, "arena", benchmarkId],
    queryFn: () => benchmarksService.arena(benchmarkId),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
}

export function useArenaVote() {
  return useMutation({
    mutationFn: (request: BenchmarkVoteRequest) => benchmarksService.vote(request),
  });
}
