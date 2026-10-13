import { benchmarkItemResultSchema, type BenchmarkItemResult } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { IEnv } from "~/types";

const RESULTS_PREFIX = "benchmarks/runs";
const PHOTOS_PREFIX = "benchmarks/photos";

export class BenchmarkResultStore {
  constructor(private readonly bucket: R2Bucket) {}

  static forEnv(env: Pick<IEnv, "PRIVATE_ASSETS_BUCKET">): BenchmarkResultStore {
    if (!env.PRIVATE_ASSETS_BUCKET) {
      throw new AssistantError(
        "Benchmarks need a private storage bucket",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return new BenchmarkResultStore(env.PRIVATE_ASSETS_BUCKET);
  }

  async readResults(runId: string): Promise<BenchmarkItemResult[]> {
    const object = await this.bucket.get(`${RESULTS_PREFIX}/${runId}.json`);

    return object ? benchmarkItemResultSchema.array().parse(await object.json()) : [];
  }

  async writeResults(runId: string, results: readonly BenchmarkItemResult[]): Promise<void> {
    await this.bucket.put(`${RESULTS_PREFIX}/${runId}.json`, JSON.stringify(results), {
      httpMetadata: { contentType: "application/json" },
    });
  }

  async deleteResults(runId: string): Promise<void> {
    await this.bucket.delete(`${RESULTS_PREFIX}/${runId}.json`);
  }

  async readPhoto(key: string): Promise<Uint8Array<ArrayBuffer> | null> {
    const object = await this.bucket.get(`${PHOTOS_PREFIX}/${key}`);

    return object ? new Uint8Array(await object.arrayBuffer()) : null;
  }

  async writePhoto(key: string, bytes: Uint8Array): Promise<void> {
    await this.bucket.put(`${PHOTOS_PREFIX}/${key}`, bytes, {
      httpMetadata: { contentType: "image/jpeg" },
    });
  }
}
