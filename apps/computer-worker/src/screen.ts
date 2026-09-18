import { getSandbox } from "@cloudflare/sandbox";
import { errorResponse } from "@ngriffin_uk/polychat-library-sandbox";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";

import { startComputer } from "./browser";
import { RESOURCE_ID_PATTERN, SCREEN_PORT, SCREEN_TTL_MS } from "./constants";
import { computerLeaseFence } from "./fencing";
import { signScreenAccess, verifyScreenAccess } from "./screen-access";
import { startTeachingRecording } from "./teaching-recording";
import type { ComputerRequest, ComputerSandbox, Env } from "./types";

const LOCAL_SCREEN_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const SCREEN_PROXY_HEADERS = {
  proxy: "x-sandbox-preview-proxy",
  port: "x-sandbox-preview-port",
  token: "x-sandbox-preview-token",
  sandboxId: "x-sandbox-preview-sandbox-id",
} as const;

const SDK_PREVIEW_HEADER_NAMES = new Set<string>(Object.values(SCREEN_PROXY_HEADERS));

const FORWARDED_HEADER_PREFIXES = ["cf-", "x-forwarded-"];

const STRIPPED_SCREEN_HEADERS = new Set([
  "authorization",
  "cookie",
  "host",
  "proxy-authorization",
  "referer",
  "x-real-ip",
]);

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie") ?? "";

  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");

    if (key === name) {
      return value.join("=");
    }
  }

  return null;
}

async function screenExposureToken(resourceId: string): Promise<string> {
  return `v${(await sha256Hex(resourceId)).slice(0, 12)}`;
}

function isLocalScreenHost(host: string): boolean {
  return LOCAL_SCREEN_HOSTNAMES.has(host.split(":")[0] ?? "");
}

function screenAccessOrigin(host: string): string {
  return isLocalScreenHost(host) ? `http://${host}` : `https://${host}`;
}

const SCREEN_PATH_SEGMENT = "screen";

function screenPath(token: string): string {
  return `/${SCREEN_PATH_SEGMENT}/${token}`;
}

function readScreenPath(pathname: string): { token: string; rest: string } | null {
  const prefix = `/${SCREEN_PATH_SEGMENT}/`;

  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const remainder = pathname.slice(prefix.length);
  const separator = remainder.indexOf("/");
  const token = separator === -1 ? remainder : remainder.slice(0, separator);
  const rest = separator === -1 ? "/" : remainder.slice(separator);

  return token ? { token, rest } : null;
}

function buildScreenProxyHeaders(request: Request, resourceId: string, token: string): Headers {
  const headers = new Headers(request.headers);

  for (const name of request.headers.keys()) {
    const lower = name.toLowerCase();

    if (
      STRIPPED_SCREEN_HEADERS.has(lower) ||
      SDK_PREVIEW_HEADER_NAMES.has(lower) ||
      FORWARDED_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix))
    ) {
      headers.delete(name);
    }
  }

  headers.set(SCREEN_PROXY_HEADERS.proxy, "1");
  headers.set(SCREEN_PROXY_HEADERS.port, String(SCREEN_PORT));
  headers.set(SCREEN_PROXY_HEADERS.token, token);
  headers.set(SCREEN_PROXY_HEADERS.sandboxId, resourceId);

  return headers;
}

export async function createScreenConnection(
  sandbox: ComputerSandbox,
  env: Env,
  input: ComputerRequest,
): Promise<{ screenUrl: string; expiresAt: string }> {
  if (!env.COMPUTER_SCREEN_HOST || !env.COMPUTER_SCREEN_SECRET) {
    throw new Error("Computer screen access is not configured");
  }

  await startComputer(sandbox);

  if (input.recordingId) {
    await startTeachingRecording(sandbox, input.recordingId);
  }

  return exposeScreen(sandbox, {
    resourceId: input.resourceId,
    fence: input.fence ?? 0,
    recordingId: input.recordingId,
    host: env.COMPUTER_SCREEN_HOST,
    secret: env.COMPUTER_SCREEN_SECRET,
  });
}

export async function createViewScreenConnection(
  sandbox: ComputerSandbox,
  env: Env,
  resourceId: string,
): Promise<{ screenUrl: string; expiresAt: string }> {
  if (!env.COMPUTER_SCREEN_HOST || !env.COMPUTER_SCREEN_SECRET) {
    throw new Error("Computer screen access is not configured");
  }

  await startComputer(sandbox);

  return exposeScreen(sandbox, {
    resourceId,
    fence: await computerLeaseFence(sandbox).ensureInitialised(),
    viewOnly: true,
    host: env.COMPUTER_SCREEN_HOST,
    secret: env.COMPUTER_SCREEN_SECRET,
  });
}

async function exposeScreen(
  sandbox: ComputerSandbox,
  params: {
    resourceId: string;
    fence: number;
    host: string;
    secret: string;
    recordingId?: string;
    viewOnly?: boolean;
  },
): Promise<{ screenUrl: string; expiresAt: string }> {
  const exposed = await sandbox.exposePort(SCREEN_PORT, {
    hostname: params.host,
    name: "computer-screen",
    token: await screenExposureToken(params.resourceId),
  });
  const expiresAt = new Date(Date.now() + SCREEN_TTL_MS).toISOString();
  const access = await signScreenAccess(params.secret, {
    origin: screenAccessOrigin(params.host),
    resourceId: params.resourceId,
    fence: params.fence,
    exp: Date.parse(expiresAt),
    ...(params.viewOnly ? { viewOnly: true } : {}),
    ...(params.recordingId ? { recordingId: params.recordingId } : {}),
  });
  const screenBase = isLocalScreenHost(params.host) ? `http://${params.host}` : exposed.url;
  const screenUrl = new URL(`${screenPath(access)}/vnc.html`, screenBase);

  screenUrl.searchParams.set("autoconnect", "1");
  screenUrl.searchParams.set("resize", "scale");
  screenUrl.searchParams.set("path", `${SCREEN_PATH_SEGMENT}/${access}/websockify`);

  if (params.viewOnly) {
    screenUrl.searchParams.set("view_only", "1");
  }

  return { screenUrl: screenUrl.toString(), expiresAt };
}

export async function handleScreenRequest(request: Request, env: Env): Promise<Response> {
  if (!env.COMPUTER_SCREEN_HOST || !env.COMPUTER_SCREEN_SECRET) {
    return errorResponse(503, "Computer screen access is not configured");
  }

  const url = new URL(request.url);
  const screenPathToken = readScreenPath(url.pathname);
  const access =
    screenPathToken?.token ??
    url.searchParams.get("access") ??
    readCookie(request, "computer_screen_access");
  const screenAccess = access
    ? await verifyScreenAccess(
        env.COMPUTER_SCREEN_SECRET,
        access,
        screenAccessOrigin(env.COMPUTER_SCREEN_HOST),
      )
    : null;

  if (!screenAccess || !RESOURCE_ID_PATTERN.test(screenAccess.resourceId)) {
    return errorResponse(401, "Screen session is invalid or expired");
  }

  const sandbox = getSandbox(env.Computer, screenAccess.resourceId, { normalizeId: true });

  if (
    !screenAccess.viewOnly &&
    (await computerLeaseFence(sandbox).current()) !== screenAccess.fence
  ) {
    return errorResponse(401, "Screen session has been revoked");
  }

  const exposureToken = await screenExposureToken(screenAccess.resourceId);
  const proxyScreen = () => {
    const upstreamUrl = new URL(request.url);

    upstreamUrl.pathname = screenPathToken?.rest ?? url.pathname;

    return sandbox.fetch(
      new Request(upstreamUrl, {
        method: request.method,
        headers: buildScreenProxyHeaders(request, screenAccess.resourceId, exposureToken),
        redirect: "manual",
      }),
    );
  };

  let response: Response;

  try {
    response = await proxyScreen();

    if (response.status === 410) {
      await sandbox.exposePort(SCREEN_PORT, {
        hostname: env.COMPUTER_SCREEN_HOST,
        name: "computer-screen",
        token: exposureToken,
      });
      response = await proxyScreen();
    }
  } catch {
    return errorResponse(502, "Screen connection failed");
  }

  return response;
}
