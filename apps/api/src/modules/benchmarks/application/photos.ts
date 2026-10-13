import { geoguessPhotoFor, getBenchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import type { BenchmarkId } from "@ngriffin_uk/polychat-schemas";
import { isJpeg, stripJpegMetadata } from "@ngriffin_uk/polychat-utility-core";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { IEnv } from "~/types";

import { BenchmarkResultStore } from "../infrastructure/BenchmarkResultStore";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "Polychat-Benchmarks/1.0 (+https://polychat.app/benchmarks)";

function photoKey(benchmarkId: BenchmarkId, itemId: string): string {
  return `${benchmarkId}/v${getBenchmark(benchmarkId).summary.version}/${itemId}.jpg`;
}

async function fetchSourcePhoto(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/jpeg" },
    signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AssistantError(
      `The source photo could not be fetched (${response.status})`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.byteLength > MAX_PHOTO_BYTES || !isJpeg(bytes)) {
    throw new AssistantError("The source photo is not a usable JPEG", ErrorType.PROVIDER_ERROR);
  }

  return stripJpegMetadata(bytes);
}

export async function loadBenchmarkPhoto(
  env: IEnv,
  benchmarkId: BenchmarkId,
  itemId: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const photo = benchmarkId === "geoguess" ? geoguessPhotoFor(itemId) : null;

  if (!photo) {
    throw new AssistantError("Photo not found", ErrorType.NOT_FOUND, 404);
  }

  const store = BenchmarkResultStore.forEnv(env);
  const key = photoKey(benchmarkId, itemId);
  const cached = await store.readPhoto(key);

  if (cached) {
    return cached;
  }

  const stripped = Uint8Array.from(await fetchSourcePhoto(photo.imageUrl));

  await store.writePhoto(key, stripped);

  return stripped;
}

export async function loadBenchmarkPhotoDataUrl(
  env: IEnv,
  benchmarkId: BenchmarkId,
  itemId: string,
): Promise<string> {
  return `data:image/jpeg;base64,${bufferToBase64(await loadBenchmarkPhoto(env, benchmarkId, itemId))}`;
}
