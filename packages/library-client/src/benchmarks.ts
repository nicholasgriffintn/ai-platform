import type {
  BenchmarkArenaPair,
  BenchmarkBoard,
  BenchmarkEstimate,
  BenchmarkId,
  BenchmarkIndex,
  BenchmarkPlayResult,
  BenchmarkPlayStart,
  BenchmarkPlaySubmitRequest,
  BenchmarkRun,
  BenchmarkRunDetail,
  BenchmarkVisibility,
  BenchmarkVoteRequest,
  BenchmarkVoteResult,
  ListPage,
  StartBenchmarkRunsRequest,
} from "@ngriffin_uk/polychat-schemas";

import { API_BASE_URL } from "./constants.js";
import { fetchApiData } from "./fetch-wrapper.js";

const BENCHMARKS_PATH = "/benchmarks";

export function benchmarkAssetUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export const benchmarksService = {
  index(): Promise<BenchmarkIndex> {
    return fetchApiData(BENCHMARKS_PATH);
  },
  board(benchmarkId: BenchmarkId): Promise<BenchmarkBoard> {
    return fetchApiData(`${BENCHMARKS_PATH}/${encodeURIComponent(benchmarkId)}`);
  },
  entrant(benchmarkId: BenchmarkId, modelId: string): Promise<BenchmarkRunDetail> {
    return fetchApiData(
      `${BENCHMARKS_PATH}/${encodeURIComponent(benchmarkId)}/models/${encodeURIComponent(modelId)}`,
    );
  },
  shared(token: string): Promise<BenchmarkRunDetail> {
    return fetchApiData(`${BENCHMARKS_PATH}/runs/shared/${encodeURIComponent(token)}`);
  },
  estimate(request: StartBenchmarkRunsRequest): Promise<BenchmarkEstimate> {
    return fetchApiData(`${BENCHMARKS_PATH}/runs/estimate`, { method: "POST", body: request });
  },
  start(request: StartBenchmarkRunsRequest): Promise<{ runs: BenchmarkRun[] }> {
    return fetchApiData(`${BENCHMARKS_PATH}/runs`, { method: "POST", body: request });
  },
  async myRuns(): Promise<BenchmarkRun[]> {
    return (await fetchApiData<ListPage<BenchmarkRun>>(`${BENCHMARKS_PATH}/runs`)).data;
  },
  run(runId: string): Promise<BenchmarkRunDetail> {
    return fetchApiData(`${BENCHMARKS_PATH}/runs/${encodeURIComponent(runId)}`);
  },
  share(runId: string, visibility: BenchmarkVisibility): Promise<BenchmarkRun> {
    return fetchApiData(`${BENCHMARKS_PATH}/runs/${encodeURIComponent(runId)}`, {
      method: "PATCH",
      body: { visibility },
    });
  },
  remove(runId: string): Promise<{ deleted: true }> {
    return fetchApiData(`${BENCHMARKS_PATH}/runs/${encodeURIComponent(runId)}`, {
      method: "DELETE",
    });
  },
  arena(benchmarkId: BenchmarkId): Promise<{ pair: BenchmarkArenaPair | null }> {
    return fetchApiData(`${BENCHMARKS_PATH}/${encodeURIComponent(benchmarkId)}/arena`);
  },
  vote(request: BenchmarkVoteRequest): Promise<BenchmarkVoteResult> {
    return fetchApiData(`${BENCHMARKS_PATH}/votes`, { method: "POST", body: request });
  },
  play(benchmarkId: BenchmarkId): Promise<BenchmarkPlayStart> {
    return fetchApiData(`${BENCHMARKS_PATH}/${encodeURIComponent(benchmarkId)}/play`, {
      method: "POST",
    });
  },
  submitPlay(request: BenchmarkPlaySubmitRequest): Promise<BenchmarkPlayResult> {
    return fetchApiData(`${BENCHMARKS_PATH}/plays`, { method: "POST", body: request });
  },
};
