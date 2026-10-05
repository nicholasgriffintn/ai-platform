import {
  OperationTimeoutError,
  withAbortTimeout,
} from "@ngriffin_uk/polychat-utility-server/async";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { parseProviderRetryAfterMs } from "@ngriffin_uk/polychat-utility-server/provider-errors";
import {
  readNumericField,
  readRecordObjectField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";
import { withRetry } from "@ngriffin_uk/polychat-utility-server/retries";
import { appendUrlPath } from "@ngriffin_uk/polychat-utility-server/urls";

import type { OtlpExportRequest } from "./otel.js";
import type { OtlpHttpSinkOptions } from "./otlp-http.js";

export class OtlpExportError extends Error {
  constructor(
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(
      status === undefined
        ? "OTLP collector request failed"
        : `OTLP collector returned HTTP ${status}`,
    );
    this.name = "OtlpExportError";
  }
}

function isRetryableExport(error: unknown): boolean {
  return (
    error instanceof OtlpExportError &&
    (error.status === undefined || [429, 502, 503, 504].includes(error.status))
  );
}

async function inspectExportResponse(response: Response): Promise<void> {
  const text = await readResponseTextWithinLimit(response, 16_384);

  if (!text.trim()) {
    return;
  }

  const body = safeParseJson(text);

  if (!body) {
    throw new Error("OTLP collector returned an invalid response");
  }

  const partial = readRecordObjectField(body, "partialSuccess");

  for (const key of ["rejectedSpans", "rejectedLogRecords", "rejectedDataPoints"]) {
    if ((readNumericField(partial, key) ?? 0) > 0) {
      throw new Error("OTLP collector rejected part of the export");
    }
  }
}

export function createOtlpTransport(
  options: OtlpHttpSinkOptions,
  endpoint: string,
  timeoutMs: number,
) {
  const fetcher = options.fetcher ?? fetch;

  return async (path: string, request: OtlpExportRequest) => {
    const body = JSON.stringify(request);

    await withRetry(
      async () => {
        try {
          await withAbortTimeout(async (signal) => {
            let response: Response;

            try {
              const headers = new Headers(options.headers);

              headers.set("Content-Type", "application/json");
              response = await fetcher(appendUrlPath(endpoint, path), {
                method: "POST",
                headers,
                body,
                redirect: "error",
                signal,
              });
            } catch {
              throw new OtlpExportError();
            }

            if (response.status !== 200) {
              const retryAfterMs = parseProviderRetryAfterMs(response.headers.get("Retry-After"));

              await response.body?.cancel();
              throw new OtlpExportError(response.status, retryAfterMs);
            }

            await inspectExportResponse(response);
          }, timeoutMs);
        } catch (error) {
          if (error instanceof OperationTimeoutError) {
            throw new OtlpExportError();
          }

          throw error;
        }
      },
      {
        maxAttempts: 3,
        baseDelayMs: 250,
        maxDelayMs: 2000,
        isRetryableError: isRetryableExport,
        getRetryAfterMs: (error) =>
          error instanceof OtlpExportError ? error.retryAfterMs : undefined,
        sleep: options.sleep,
      },
    );
  };
}
