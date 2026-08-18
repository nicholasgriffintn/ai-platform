export interface FetchApiOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | object | null;
  timeoutMs?: number | null;
}

export type PolychatHeadersProvider = () => HeadersInit | Promise<HeadersInit>;
export type PolychatCsrfTokenProvider = () => string | null | Promise<string | null>;

export interface PolychatClientOptions {
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  credentials?: RequestCredentials;
  defaultTimeoutMs?: number | null;
  getCsrfToken?: PolychatCsrfTokenProvider;
  getHeaders?: PolychatHeadersProvider;
  csrfHeaderName?: string;
}

export interface PolychatClient {
  fetch(path: string, options?: FetchApiOptions): Promise<Response>;
  fetchOrThrow(path: string, options?: FetchApiOptions): Promise<Response>;
  read<T>(response: Response): Promise<T>;
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly data?: unknown;

  constructor(message: string, status: number, data?: unknown, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractApiErrorCode(parsed: unknown): string | undefined {
  if (!isRecord(parsed)) {
    return undefined;
  }

  if (isRecord(parsed.error) && typeof parsed.error.code === "string") {
    return parsed.error.code;
  }

  return typeof parsed.code === "string" ? parsed.code : undefined;
}

function extractApiErrorMessage(parsed: unknown, fallback: string): string {
  if (typeof parsed === "string" && parsed.trim()) {
    return parsed;
  }

  if (!isRecord(parsed)) {
    return fallback;
  }

  if (isRecord(parsed.error) && typeof parsed.error.message === "string") {
    return parsed.error.message;
  }

  if (typeof parsed.error === "string") {
    return parsed.error;
  }

  if (typeof parsed.message === "string") {
    return parsed.message;
  }

  if (Array.isArray(parsed.details)) {
    const firstDetail = parsed.details[0];

    if (
      isRecord(firstDetail) &&
      typeof firstDetail.message === "string" &&
      firstDetail.message.trim()
    ) {
      return firstDetail.message;
    }
  }

  return fallback;
}

async function readApiErrorData(response: Response): Promise<unknown> {
  let bodyText: string;

  try {
    bodyText = await response.clone().text();
  } catch {
    return undefined;
  }

  if (!bodyText.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

function isInstanceOfGlobal<T>(
  value: unknown,
  constructor: { new (...args: never[]): T } | undefined,
): value is T {
  return Boolean(constructor && value instanceof constructor);
}

function isBodyInit(value: BodyInit | object): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    isInstanceOfGlobal(value, globalThis.Blob) ||
    isInstanceOfGlobal(value, globalThis.FormData) ||
    isInstanceOfGlobal(value, globalThis.URLSearchParams) ||
    isInstanceOfGlobal(value, globalThis.ReadableStream)
  );
}

function isFormData(value: unknown): value is FormData {
  return isInstanceOfGlobal(value, globalThis.FormData);
}

function resolveUrl(baseUrl: string, path: string): string {
  const base = new URL(baseUrl);
  const resolved = new URL(path, `${base.toString().replace(/\/$/, "")}/`);

  if (resolved.origin !== base.origin) {
    throw new Error("Polychat client request paths must remain on the configured API origin");
  }

  return resolved.toString();
}

export async function createApiErrorFromResponse(
  response: Response,
  fallback = response.statusText || "Request failed",
): Promise<ApiError> {
  const parsed = await readApiErrorData(response);

  return new ApiError(
    extractApiErrorMessage(parsed, fallback),
    response.status,
    parsed,
    extractApiErrorCode(parsed),
  );
}

export async function returnFetchedData<T>(response: Response): Promise<T> {
  try {
    const data: T = await response.json();

    return isRecord(data) && "data" in data ? (data.data as T) : data;
  } catch {
    throw new Error("Failed to parse response JSON");
  }
}

export function createPolychatClient(options: PolychatClientOptions): PolychatClient {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  async function performFetch(
    path: string,
    requestOptions: FetchApiOptions = {},
  ): Promise<Response> {
    const requestUrl = resolveUrl(options.baseUrl, path);
    const { timeoutMs, ...requestInit } = requestOptions;
    const providedHeaders = options.getHeaders ? await options.getHeaders() : undefined;
    const headers = new Headers(providedHeaders);

    new Headers(requestInit.headers).forEach((value, key) => headers.set(key, value));

    if (!isFormData(requestInit.body) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const method = requestInit.method?.toUpperCase() || "GET";

    if (!SAFE_METHODS.has(method) && options.getCsrfToken) {
      const csrfToken = await options.getCsrfToken();

      if (csrfToken) {
        headers.set(options.csrfHeaderName ?? "X-CSRF-Token", csrfToken);
      }
    }

    const resolvedTimeout =
      timeoutMs === null || timeoutMs === 0 ? null : (timeoutMs ?? defaultTimeoutMs);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const fetchOptions: RequestInit = {
      ...requestInit,
      headers,
      credentials: requestInit.credentials ?? options.credentials,
      body: undefined,
    };

    if (!requestInit.signal && resolvedTimeout !== null) {
      const controller = new AbortController();

      fetchOptions.signal = controller.signal;
      timeoutId = setTimeout(() => controller.abort(), resolvedTimeout);
    }

    if (requestInit.body !== null && requestInit.body !== undefined) {
      fetchOptions.body = isBodyInit(requestInit.body)
        ? requestInit.body
        : JSON.stringify(requestInit.body);
    }

    try {
      return await options.fetch(requestUrl, fetchOptions);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  return {
    fetch: performFetch,
    async fetchOrThrow(path, requestOptions) {
      const response = await performFetch(path, requestOptions);

      if (!response.ok) {
        throw await createApiErrorFromResponse(response);
      }

      return response;
    },
    read: returnFetchedData,
  };
}
