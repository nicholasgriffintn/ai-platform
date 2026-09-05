import { getSandbox } from "@cloudflare/sandbox";
import {
  INTERNAL_SERVICE_AUTHORIZATION_HEADER,
  NO_STORE,
  sandboxPreviewAuthorisationResponseSchema,
  sandboxPreviewExposureRequestSchema,
  sandboxPreviewExposureResponseSchema,
  sandboxPreviewOriginIdSchema,
  type SandboxPreviewAuthorisationResponse,
  type SandboxPreviewGrantClaims,
} from "@ngriffin_uk/polychat-schemas";

import type { Env } from "../types";
import { createInternalServiceToken, verifySandboxPreviewGrant } from "./auth";

const INTERNAL_EXPOSURE_ORIGIN = "http://sandbox";
const INTERNAL_AUTHORISATION_URL = "http://api/apps/sandbox/previews/authorise";
const PREVIEW_COOKIE = "__Host-polychat_preview";
const PREVIEW_OPEN_PATH = "/__polychat/preview/open";
const MAX_WEBSOCKET_MESSAGE_BYTES = 1024 * 1024;
const SDK_PREVIEW_HEADERS = {
  proxy: "x-sandbox-preview-proxy",
  port: "x-sandbox-preview-port",
  token: "x-sandbox-preview-token",
  sandboxId: "x-sandbox-preview-sandbox-id",
} as const;

interface PreviewOrigin {
  id: string;
  origin: string;
}

function configuredPreviewHost(env: Env): URL | null {
  const value = env.SANDBOX_PREVIEW_HOST?.trim();

  if (!value) {
    return null;
  }

  try {
    const protocol = env.ENV === "development" ? "http" : "https";
    const parsed = new URL(`${protocol}://${value}`);

    return parsed.host === value && parsed.pathname === "/" ? parsed : null;
  } catch {
    return null;
  }
}

function resolvePreviewOrigin(request: Request, env: Env): PreviewOrigin | null {
  const base = configuredPreviewHost(env);

  if (!base) {
    return null;
  }

  const url = new URL(request.url);
  const suffix = `.${base.hostname}`;

  if (url.protocol !== base.protocol || url.port !== base.port || !url.hostname.endsWith(suffix)) {
    return null;
  }

  const id = url.hostname.slice(0, -suffix.length);
  const parsedId = sandboxPreviewOriginIdSchema.safeParse(id);

  if (!parsedId.success || id.includes(".")) {
    return null;
  }

  return { id: parsedId.data, origin: url.origin };
}

function configuredParentOrigin(env: Env): string | null {
  const value = env.APP_BASE_URL?.trim() || "https://polychat.app";
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    parsed.username ||
    parsed.password ||
    parsed.origin !== value.replace(/\/$/, "")
  ) {
    return null;
  }

  return parsed.origin;
}

function responseHeaders(parentOrigin: string): Headers {
  return new Headers({
    "Cache-Control": NO_STORE,
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      `frame-ancestors ${parentOrigin}`,
      "form-action 'self'",
      "frame-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
    ].join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
  });
}

function errorResponse(status: number, state: "denied" | "expired" | "unavailable"): Response {
  return Response.json(
    {
      error:
        state === "expired"
          ? "Preview expired"
          : state === "denied"
            ? "Preview access denied"
            : "Preview unavailable",
      state,
    },
    {
      status,
      headers: {
        "Cache-Control": NO_STORE,
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function cookieValue(request: Request): string | null {
  const cookie = request.headers.get("Cookie");

  if (!cookie) {
    return null;
  }

  for (const entry of cookie.split(";")) {
    const separator = entry.indexOf("=");

    if (separator < 0 || entry.slice(0, separator).trim() !== PREVIEW_COOKIE) {
      continue;
    }

    const value = entry.slice(separator + 1).trim();

    return value || null;
  }

  return null;
}

function previewCookie(token: string, maxAge: number): string {
  return [
    `${PREVIEW_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${Math.max(0, maxAge)}`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
  ].join("; ");
}

async function authorisePreview(params: {
  credential: string;
  env: Env;
  mode: "bootstrap" | "session";
  originId: string;
}): Promise<{
  claims: SandboxPreviewGrantClaims;
  result: SandboxPreviewAuthorisationResponse;
}> {
  if (!params.env.JWT_SECRET?.trim() || !params.env.POLYCHAT_API) {
    throw new Error("Preview gateway is not configured");
  }

  const claims = await verifySandboxPreviewGrant(
    params.credential,
    params.env.JWT_SECRET.trim(),
    params.mode,
  );

  if (claims.origin_id !== params.originId) {
    throw new Error("Preview origin does not match access grant");
  }

  const response = await params.env.POLYCHAT_API.fetch(
    new Request(INTERNAL_AUTHORISATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [INTERNAL_SERVICE_AUTHORIZATION_HEADER]: `Bearer ${await createInternalServiceToken(
          params.env.JWT_SECRET.trim(),
          "sandbox-preview:authorise",
        )}`,
      },
      body: JSON.stringify({
        credential: params.credential,
        mode: params.mode,
        originId: params.originId,
      }),
    }),
  );

  if (!response.ok) {
    throw new Error("Preview access denied", { cause: response.status });
  }

  const parsed = sandboxPreviewAuthorisationResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );

  if (
    !parsed.success ||
    parsed.data.runId !== claims.run_id ||
    parsed.data.serviceName !== claims.service_name ||
    parsed.data.port !== claims.port
  ) {
    throw new Error("Preview authorisation response is invalid");
  }

  return { claims, result: parsed.data };
}

function safeRequestHeaders(request: Request, authorisation: SandboxPreviewAuthorisationResponse) {
  const headers = new Headers(request.headers);

  for (const name of Array.from(headers.keys())) {
    const lowerName = name.toLowerCase();

    if (
      lowerName === "authorization" ||
      lowerName === "cookie" ||
      lowerName === "forwarded" ||
      lowerName === "host" ||
      lowerName === INTERNAL_SERVICE_AUTHORIZATION_HEADER.toLowerCase() ||
      lowerName === "proxy-authorization" ||
      lowerName === "referer" ||
      lowerName === "x-real-ip" ||
      lowerName.startsWith("cf-") ||
      lowerName.startsWith("x-forwarded-") ||
      Object.values(SDK_PREVIEW_HEADERS).some((header) => header === lowerName)
    ) {
      headers.delete(name);
    }
  }

  headers.set(SDK_PREVIEW_HEADERS.proxy, "1");
  headers.set(SDK_PREVIEW_HEADERS.port, String(authorisation.port));
  headers.set(SDK_PREVIEW_HEADERS.token, authorisation.forwardToken);
  headers.set(SDK_PREVIEW_HEADERS.sandboxId, authorisation.runId);

  return headers;
}

function securedUpstreamHeaders(upstream: Response, parentOrigin: string): Headers {
  const headers = new Headers(upstream.headers);

  for (const name of [
    "Access-Control-Allow-Credentials",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Origin",
    "Content-Security-Policy",
    "Cross-Origin-Opener-Policy",
    "Permissions-Policy",
    "Referrer-Policy",
    "Server",
    "Set-Cookie",
    "Via",
    "X-Content-Type-Options",
    "X-Powered-By",
  ]) {
    headers.delete(name);
  }

  for (const [name, value] of responseHeaders(parentOrigin)) {
    headers.set(name, value);
  }

  return headers;
}

function safeRedirectLocation(request: Request, location: string, port: number): string | null {
  let target: URL;

  try {
    target = new URL(location, request.url);
  } catch {
    return null;
  }

  const requestUrl = new URL(request.url);

  if (target.origin === requestUrl.origin) {
    return target.toString();
  }

  const loopback =
    target.hostname === "localhost" ||
    target.hostname === "127.0.0.1" ||
    target.hostname === "[::1]";

  if (loopback && Number(target.port || (target.protocol === "https:" ? 443 : 80)) === port) {
    target.protocol = requestUrl.protocol;
    target.host = requestUrl.host;

    return target.toString();
  }

  return null;
}

function messageSize(data: ArrayBuffer | string): number {
  return typeof data === "string" ? new TextEncoder().encode(data).byteLength : data.byteLength;
}

async function deriveForwardToken(secret: string, runId: string, port: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`polychat-preview-forward:${runId}:${port}`),
  );

  return Array.from(new Uint8Array(signature).slice(0, 8), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function bridgeWebSocket(params: {
  authorise: () => Promise<void>;
  expiresAt: string;
  headers: Headers;
  upstream: WebSocket;
}): Response {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  let closed = false;
  const close = (code: number, reason: string) => {
    if (closed) {
      return;
    }

    closed = true;
    clearTimeout(expiryTimer);
    server.close(code, reason);
    params.upstream.close(code, reason);
  };

  const expiryTimer = setTimeout(
    () => close(1008, "Preview expired"),
    Math.max(0, Date.parse(params.expiresAt) - Date.now()),
  );
  const forward = async (destination: WebSocket, data: ArrayBuffer | string) => {
    if (messageSize(data) > MAX_WEBSOCKET_MESSAGE_BYTES) {
      close(1009, "Preview message is too large");

      return;
    }

    try {
      await params.authorise();
      destination.send(data);
    } catch {
      close(1008, "Preview access ended");
    }
  };

  server.accept();
  params.upstream.accept();
  server.addEventListener("message", (event) => {
    if (typeof event.data === "string" || event.data instanceof ArrayBuffer) {
      void forward(params.upstream, event.data);
    } else {
      close(1003, "Unsupported preview message");
    }
  });
  params.upstream.addEventListener("message", (event) => {
    if (typeof event.data === "string" || event.data instanceof ArrayBuffer) {
      void forward(server, event.data);
    } else {
      close(1003, "Unsupported preview message");
    }
  });
  server.addEventListener("close", (event) => close(event.code || 1000, event.reason));
  params.upstream.addEventListener("close", (event) => close(event.code || 1000, event.reason));
  server.addEventListener("error", () => close(1011, "Preview connection failed"));
  params.upstream.addEventListener("error", () => close(1011, "Preview connection failed"));

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: params.headers,
  });
}

async function exposePreview(request: Request, env: Env): Promise<Response> {
  if (
    request.method !== "POST" ||
    new URL(request.url).origin !== INTERNAL_EXPOSURE_ORIGIN ||
    !env.JWT_SECRET?.trim()
  ) {
    return errorResponse(404, "unavailable");
  }

  const parsed = sandboxPreviewExposureRequestSchema.safeParse(
    await request.json().catch(() => undefined),
  );

  if (!parsed.success) {
    return errorResponse(400, "denied");
  }

  try {
    const claims = await verifySandboxPreviewGrant(
      parsed.data.grant,
      env.JWT_SECRET.trim(),
      "exposure",
    );
    const host = configuredPreviewHost(env);

    if (!host) {
      return errorResponse(503, "unavailable");
    }

    const sandbox = getSandbox(env.Sandbox, claims.run_id, { normalizeId: true });
    const forwardToken = await deriveForwardToken(
      env.JWT_SECRET.trim(),
      claims.run_id,
      claims.port,
    );

    await sandbox.exposePort(claims.port, {
      hostname: host.host,
      name: claims.service_name,
      token: forwardToken,
    });
    const response = sandboxPreviewExposureResponseSchema.safeParse({ forwardToken });

    return response.success
      ? Response.json(response.data, { headers: { "Cache-Control": NO_STORE } })
      : errorResponse(502, "unavailable");
  } catch {
    return errorResponse(401, "denied");
  }
}

async function bootstrapPreview(
  request: Request,
  env: Env,
  previewOrigin: PreviewOrigin,
): Promise<Response> {
  if (request.method !== "GET") {
    return errorResponse(405, "denied");
  }

  const grant = new URL(request.url).searchParams.get("grant");

  if (!grant) {
    return errorResponse(401, "denied");
  }

  try {
    const parentOrigin = configuredParentOrigin(env);

    if (!parentOrigin) {
      return errorResponse(503, "unavailable");
    }

    const authorised = await authorisePreview({
      credential: grant,
      env,
      mode: "bootstrap",
      originId: previewOrigin.id,
    });

    if (!authorised.result.sessionToken) {
      return errorResponse(502, "unavailable");
    }

    const maxAge = Math.floor((Date.parse(authorised.result.expiresAt) - Date.now()) / 1_000);
    const headers = responseHeaders(parentOrigin);

    headers.set("Location", "/");
    headers.set("Set-Cookie", previewCookie(authorised.result.sessionToken, maxAge));

    return new Response(null, { status: 303, headers });
  } catch (error) {
    const expired = error instanceof Error && error.cause === 410;

    return errorResponse(expired ? 410 : 401, expired ? "expired" : "denied");
  }
}

async function proxyPreview(
  request: Request,
  env: Env,
  previewOrigin: PreviewOrigin,
): Promise<Response> {
  const credential = cookieValue(request);

  if (!credential) {
    return errorResponse(401, "denied");
  }

  let authorised: Awaited<ReturnType<typeof authorisePreview>>;

  try {
    authorised = await authorisePreview({
      credential,
      env,
      mode: "session",
      originId: previewOrigin.id,
    });
  } catch (error) {
    const expired = error instanceof Error && error.cause === 410;

    return errorResponse(expired ? 410 : 401, expired ? "expired" : "denied");
  }

  const parentOrigin = configuredParentOrigin(env);

  if (!parentOrigin) {
    return errorResponse(503, "unavailable");
  }

  let upstream: Response;

  try {
    const sandbox = getSandbox(env.Sandbox, authorised.result.runId, { normalizeId: true });
    const upstreamRequest = new Request(request, {
      headers: safeRequestHeaders(request, authorised.result),
      redirect: "manual",
    });

    upstream = await sandbox.fetch(upstreamRequest);
  } catch {
    return errorResponse(502, "unavailable");
  }

  const headers = securedUpstreamHeaders(upstream, parentOrigin);

  if (upstream.status === 101 && upstream.webSocket) {
    return bridgeWebSocket({
      authorise: async () => {
        await authorisePreview({
          credential,
          env,
          mode: "session",
          originId: previewOrigin.id,
        });
      },
      expiresAt: authorised.result.expiresAt,
      headers,
      upstream: upstream.webSocket,
    });
  }

  const location = headers.get("Location");

  if (location) {
    const safeLocation = safeRedirectLocation(request, location, authorised.result.port);

    if (!safeLocation) {
      return errorResponse(502, "unavailable");
    }

    headers.set("Location", safeLocation);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function handleSandboxPreviewRequest(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.origin === INTERNAL_EXPOSURE_ORIGIN && url.pathname === "/preview/expose") {
    return exposePreview(request, env);
  }

  const previewOrigin = resolvePreviewOrigin(request, env);

  if (!previewOrigin) {
    return null;
  }

  if (url.pathname === PREVIEW_OPEN_PATH) {
    return bootstrapPreview(request, env, previewOrigin);
  }

  return proxyPreview(request, env, previewOrigin);
}
