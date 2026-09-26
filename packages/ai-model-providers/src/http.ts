import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { ModelProviderError, modelProviderErrorFromStatus } from "./errors.js";

export type Fetcher = typeof fetch;

export const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

const ERROR_DETAIL_LIMIT = 500;

export async function readUpstreamError(response: Response): Promise<string | undefined> {
  const text = (await response.text().catch(() => "")).slice(0, ERROR_DETAIL_LIMIT);

  try {
    const body: unknown = JSON.parse(text);

    if (!isRecord(body)) {
      return text || undefined;
    }

    for (const key of ["error", "message", "detail", "Message", "errorMessage"]) {
      const value = body[key];

      if (typeof value === "string") {
        return value;
      }

      if (isRecord(value) && typeof value.message === "string") {
        return value.message;
      }
    }

    if (Array.isArray(body.errors) && isRecord(body.errors[0])) {
      const first = body.errors[0];

      return typeof first.message === "string" ? first.message : text;
    }

    return text || undefined;
  } catch {
    return text || undefined;
  }
}

export interface JsonRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: BodyInit;
  context: string;
  allowNotFound?: boolean;
}

export class JsonHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly headers: () => Promise<Record<string, string>> | Record<string, string>,
    private readonly fetcher: Fetcher = defaultFetcher,
  ) {}

  url(path: string): string {
    return path.startsWith("https://") ? path : `${this.baseUrl}${path}`;
  }

  async raw(path: string, request: JsonRequest): Promise<Response> {
    const headers: Record<string, string> = { ...(await this.headers()), ...request.headers };

    if (request.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await this.fetcher(this.url(path), {
      method: request.method ?? (request.body === undefined ? "GET" : "POST"),
      headers,
      body:
        request.rawBody ?? (request.body === undefined ? undefined : JSON.stringify(request.body)),
    });

    if (!response.ok && !(request.allowNotFound && response.status === 404)) {
      throw modelProviderErrorFromStatus(
        response.status,
        request.context,
        await readUpstreamError(response),
      );
    }

    return response;
  }

  async json(path: string, request: JsonRequest): Promise<unknown> {
    const response = await this.raw(path, request);

    if (response.status === 404 && request.allowNotFound) {
      return null;
    }

    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new ModelProviderError(
        "upstream_error",
        `${request.context} returned a body that is not JSON`,
      );
    }
  }

  async record(path: string, request: JsonRequest): Promise<Record<string, unknown>> {
    const body = await this.json(path, request);

    if (!isRecord(body)) {
      throw new ModelProviderError("upstream_error", `${request.context} returned no object`);
    }

    return body;
  }
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export interface StreamingMultipart {
  body: ReadableStream<Uint8Array>;
  contentType: string;
}

export function streamingMultipart(
  fields: Record<string, string>,
  file: {
    field: string;
    filename: string;
    contentType: string;
    stream: ReadableStream<Uint8Array>;
  },
): StreamingMultipart {
  const boundary = `polychat-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    [
      ...Object.entries(fields).map(
        ([name, value]) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
    ].join(""),
  );
  const epilogue = encoder.encode(`\r\n--${boundary}--\r\n`);
  const reader = file.stream.getReader();
  let stage: "preamble" | "file" | "done" = "preamble";

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (stage === "preamble") {
          stage = "file";
          controller.enqueue(preamble);

          return;
        }

        if (stage === "file") {
          const { value, done } = await reader.read();

          if (!done) {
            controller.enqueue(value);

            return;
          }

          stage = "done";
          controller.enqueue(epilogue);

          return;
        }

        controller.close();
      },
      async cancel(reason) {
        await reader.cancel(reason);
      },
    }),
  };
}
