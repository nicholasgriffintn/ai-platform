import { safeParseJson } from "./json";

const BEARER_CREDENTIAL = /^Bearer +([A-Za-z0-9._~+/-]+=*)$/i;

export class ResponseBodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Response body exceeds the ${maxBytes}-byte limit`);
    this.name = "ResponseBodyTooLargeError";
  }
}

export async function readResponseTextWithinLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ResponseBodyTooLargeError(maxBytes);
  }

  if (!response.body) {
    const text = await response.text();

    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new ResponseBodyTooLargeError(maxBytes);
    }

    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";

  try {
    while (true) {
      // Stream chunks must be consumed in order to enforce a cumulative byte limit.
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();

      if (done) {
        return text + decoder.decode();
      }

      byteLength += value.byteLength;

      if (byteLength > maxBytes) {
        // eslint-disable-next-line no-await-in-loop
        await reader.cancel();
        throw new ResponseBodyTooLargeError(maxBytes);
      }

      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export function parseBearerToken(value: string | undefined): string | undefined {
  return value ? BEARER_CREDENTIAL.exec(value)?.[1] : undefined;
}

export function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  headers.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const normalizedName = name.toLowerCase();

  return Object.keys(headers).some((key) => key.toLowerCase() === normalizedName);
}

export function setDefaultHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
): void {
  if (!hasHeader(headers, name)) {
    headers[name] = value;
  }
}

export async function readHttpResponseBody(
  response: Response,
): Promise<{ parsed: unknown; raw: string; body: unknown; format: "json" | "text" }> {
  const raw = await response.text();

  if (!raw) {
    return { parsed: null, raw, body: raw, format: "text" };
  }

  const parsed = safeParseJson(raw);

  return {
    parsed,
    raw,
    body: parsed === null ? raw : parsed,
    format: parsed === null ? "text" : "json",
  };
}
