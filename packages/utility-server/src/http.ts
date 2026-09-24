import { safeParseJson } from "./json.js";
import { isPrivateHostname } from "./urls.js";

const BEARER_CREDENTIAL = /^Bearer +([A-Za-z0-9._~+/-]+=*)$/i;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export class UnsafeUrlError extends Error {
  constructor(_url: string) {
    super("Refusing to fetch non-public URL");
    this.name = "UnsafeUrlError";
  }
}

export function isPublicHttpUrl(url: URL): boolean {
  return (
    (url.protocol === "http:" || url.protocol === "https:") && !isPrivateHostname(url.hostname)
  );
}

export function parsePublicHttpUrl(input: string | URL): URL {
  let url: URL;

  try {
    url = new URL(input.toString());
  } catch {
    throw new UnsafeUrlError(input.toString());
  }

  if (!isPublicHttpUrl(url) || url.username || url.password) {
    throw new UnsafeUrlError(url.toString());
  }

  return url;
}

export async function fetchFollowingSafeRedirects(
  input: string | URL,
  init: RequestInit = {},
  maxRedirects = MAX_REDIRECTS,
): Promise<Response> {
  const initialUrl = parsePublicHttpUrl(input);
  let currentUrl = initialUrl;
  const currentInit: RequestInit = { ...init };
  let redirectCount = 0;

  while (true) {
    const response = await fetch(currentUrl.toString(), {
      ...currentInit,
      redirect: "manual",
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response;
    }

    const location = response.headers.get("location");

    if (!location) {
      return response;
    }

    if (redirectCount >= maxRedirects) {
      throw new Error(`Too many redirects while fetching ${initialUrl.toString()}`);
    }

    redirectCount += 1;

    const method = (currentInit.method ?? "GET").toUpperCase();

    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) &&
        method !== "GET" &&
        method !== "HEAD")
    ) {
      Object.assign(currentInit, { method: "GET", body: undefined });
    }

    currentUrl = parsePublicHttpUrl(new URL(location, currentUrl));
  }
}

export class ResponseBodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Response body exceeds the ${maxBytes}-byte limit`);
    this.name = "ResponseBodyTooLargeError";
  }
}

export async function readResponseBytesWithinLimit(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ResponseBodyTooLargeError(maxBytes);
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());

    if (bytes.byteLength > maxBytes) {
      throw new ResponseBodyTooLargeError(maxBytes);
    }

    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        const bytes = new Uint8Array(byteLength);
        let offset = 0;

        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }

        return bytes;
      }

      byteLength += value.byteLength;

      if (byteLength > maxBytes) {
        await reader.cancel();
        throw new ResponseBodyTooLargeError(maxBytes);
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
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
      const { done, value } = await reader.read();

      if (done) {
        return text + decoder.decode();
      }

      byteLength += value.byteLength;

      if (byteLength > maxBytes) {
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
