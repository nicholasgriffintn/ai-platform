import { CsvRecordParser, isRecord, readTextLines } from "@ngriffin_uk/polychat-utility-core";
import { type AsyncBuffer, parquetMetadataAsync, parquetReadObjects, toJson } from "hyparquet";

import { badRequest } from "~/modules/model-registry/application/access";

const PARQUET_WINDOW_ROWS = 2000;
const MAX_JSON_ARRAY_BYTES = 64 * 1024 * 1024;

export type SourceFormat = "jsonl" | "json" | "csv" | "parquet";

export function formatFromPath(path: string): SourceFormat {
  const lower = path.toLowerCase();

  if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) {
    return "jsonl";
  }

  if (lower.endsWith(".json")) {
    return "json";
  }

  if (lower.endsWith(".csv")) {
    return "csv";
  }

  if (lower.endsWith(".parquet")) {
    return "parquet";
  }

  throw badRequest(`Unsupported dataset file ${path}; use JSONL, JSON, CSV or Parquet`);
}

async function* jsonLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  for await (const line of readTextLines(stream)) {
    if (!line.trim()) {
      continue;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(line);
    } catch {
      yield { __invalid: line.slice(0, 200) };
      continue;
    }

    yield isRecord(parsed) ? parsed : { value: parsed };
  }
}

async function* csvRows(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const parser = new CsvRecordParser();
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let header: string[] | null = null;

  const emit = function* (records: string[][]) {
    for (const record of records) {
      if (!header) {
        header = record.map((name) => name.trim());
        continue;
      }

      if (record.some((value) => value !== "")) {
        const names = header;

        yield Object.fromEntries(names.map((name, index) => [name, record[index] ?? ""]));
      }
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      yield* emit(parser.push(decoder.decode(value, { stream: true })));
    }

    yield* emit(parser.push(decoder.decode()));
    yield* emit(parser.finish());
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function* jsonArray(
  stream: ReadableStream<Uint8Array>,
  size: number,
): AsyncGenerator<Record<string, unknown>> {
  if (size > MAX_JSON_ARRAY_BYTES) {
    throw badRequest("JSON arrays over 64 MB are not supported; use JSONL instead");
  }

  const parsed: unknown = JSON.parse(await new Response(stream).text());
  const rows = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.data)
      ? parsed.data
      : [];

  for (const row of rows) {
    yield isRecord(row) ? row : { value: row };
  }
}

export async function* parquetRows(
  file: AsyncBuffer,
  limit: number | null,
): AsyncGenerator<Record<string, unknown>> {
  const metadata = await parquetMetadataAsync(file);
  const total = Number(metadata.num_rows);
  const end = limit === null ? total : Math.min(total, limit);

  for (let start = 0; start < end; start += PARQUET_WINDOW_ROWS) {
    const rows = await parquetReadObjects({
      file,
      metadata,
      rowStart: start,
      rowEnd: Math.min(end, start + PARQUET_WINDOW_ROWS),
    });

    for (const row of rows) {
      const plain: unknown = toJson(row);

      yield isRecord(plain) ? plain : { value: plain };
    }
  }
}

export function streamRows(
  format: Exclude<SourceFormat, "parquet">,
  stream: ReadableStream<Uint8Array>,
  size: number,
): AsyncGenerator<Record<string, unknown>> {
  if (format === "jsonl") {
    return jsonLines(stream);
  }

  return format === "csv" ? csvRows(stream) : jsonArray(stream, size);
}

export function r2AsyncBuffer(bucket: R2Bucket, key: string, byteLength: number): AsyncBuffer {
  return {
    byteLength,
    async slice(start: number, end?: number) {
      const object = await bucket.get(key, {
        range: { offset: start, length: (end ?? byteLength) - start },
      });

      if (!object) {
        throw new Error(`${key} disappeared while reading`);
      }

      return object.arrayBuffer();
    },
  };
}

export function httpAsyncBuffer(
  url: string,
  byteLength: number,
  headers: Record<string, string>,
  fetcher: (url: string, init?: RequestInit) => Promise<Response>,
): AsyncBuffer {
  return {
    byteLength,
    async slice(start: number, end?: number) {
      const rangeEnd = end ?? byteLength;
      const response = await fetcher(url, {
        headers: { ...headers, Range: `bytes=${start}-${rangeEnd - 1}` },
      });

      if (!response.ok) {
        throw new Error(`Reading ${url} failed with ${response.status}`);
      }

      const expectedRange = `bytes ${start}-${rangeEnd - 1}/${byteLength}`;

      if (
        (response.status !== 206 && (start !== 0 || rangeEnd !== byteLength)) ||
        (response.status === 206 && response.headers.get("content-range") !== expectedRange)
      ) {
        await response.body?.cancel();
        throw new Error("The dataset server did not return the requested byte range");
      }

      const bytes = await response.arrayBuffer();

      if (bytes.byteLength !== rangeEnd - start) {
        throw new Error("The dataset server returned an incomplete byte range");
      }

      return bytes;
    },
  };
}
