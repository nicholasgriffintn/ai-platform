import { getSandbox, proxyToSandbox } from "@cloudflare/sandbox";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";

import { startComputer } from "./browser";
import { RESOURCE_ID_PATTERN, SCREEN_PORT, SCREEN_TTL_MS } from "./constants";
import { signScreenAccess, verifyScreenAccess } from "./crypto";
import { readFence } from "./fencing";
import { errorResponse } from "./http";
import { createTeachingFrameRecorder, startTeachingRecording } from "./teaching-recording";
import type { ComputerRequest, ComputerSandbox, Env } from "./types";

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
  return `screen_${await sha256Hex(resourceId)}`;
}

function createScreenWebSocketProxy(
  response: Response,
  sandbox: ComputerSandbox,
  fence: number,
  expiresAt: number,
  headers: Headers,
  recordingId?: string,
): Response {
  const upstream = response.webSocket;

  if (!upstream) {
    return new Response(response.body, { status: response.status, headers });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  let closed = false;
  let clientQueue = Promise.resolve();
  let upstreamQueue = Promise.resolve();
  const recordFrame = recordingId ? createTeachingFrameRecorder(sandbox, recordingId) : null;

  const close = (reason: string) => {
    if (closed) {
      return;
    }

    closed = true;
    server.close(1000, reason);
    upstream.close(1000, reason);
  };

  const sessionIsActive = async () =>
    Date.now() < expiresAt && (await readFence(sandbox)) === fence;
  const forward = async (destination: WebSocket, data: string | ArrayBuffer) => {
    if (closed) {
      return;
    }

    if (!(await sessionIsActive())) {
      close("Screen session expired");

      return;
    }

    destination.send(data);
  };

  server.accept();
  server.addEventListener("message", (event) => {
    clientQueue = clientQueue
      .then(async () => {
        if (recordFrame) {
          await recordFrame(event.data);
        }

        await forward(upstream, event.data);
      })
      .catch(() => close("Screen connection failed"));
  });
  upstream.addEventListener("message", (event) => {
    upstreamQueue = upstreamQueue
      .then(() => forward(server, event.data))
      .catch(() => close("Screen connection failed"));
  });
  server.addEventListener("close", () => close("Screen closed"));
  upstream.addEventListener("close", () => close("Screen closed"));
  server.addEventListener("error", () => close("Screen connection failed"));
  upstream.addEventListener("error", () => close("Screen connection failed"));
  setTimeout(() => close("Screen session expired"), Math.max(0, expiresAt - Date.now()));

  return new Response(null, { status: 101, headers, webSocket: client });
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

  const exposed = await sandbox.exposePort(SCREEN_PORT, {
    hostname: env.COMPUTER_SCREEN_HOST,
    name: "computer-screen",
    token: await screenExposureToken(input.resourceId),
  });
  const expiresAt = new Date(Date.now() + SCREEN_TTL_MS).toISOString();
  const screenUrl = new URL("/vnc.html", exposed.url);
  const access = await signScreenAccess(env.COMPUTER_SCREEN_SECRET, {
    origin: screenUrl.origin,
    resourceId: input.resourceId,
    fence: input.fence,
    exp: Date.parse(expiresAt),
    ...(input.recordingId ? { recordingId: input.recordingId } : {}),
  });

  screenUrl.searchParams.set("autoconnect", "1");
  screenUrl.searchParams.set("resize", "scale");
  screenUrl.searchParams.set("access", access);

  return { screenUrl: screenUrl.toString(), expiresAt };
}

export async function handleScreenRequest(request: Request, env: Env): Promise<Response> {
  if (!env.COMPUTER_SCREEN_SECRET) {
    return errorResponse(503, "Computer screen access is not configured");
  }

  const url = new URL(request.url);
  const access = url.searchParams.get("access") ?? readCookie(request, "computer_screen_access");
  const screenAccess = access
    ? await verifyScreenAccess(env.COMPUTER_SCREEN_SECRET, access, url.origin)
    : null;

  if (!screenAccess || !RESOURCE_ID_PATTERN.test(screenAccess.resourceId)) {
    return errorResponse(401, "Screen session is invalid or expired");
  }

  const sandbox = getSandbox(env.Computer, screenAccess.resourceId, { normalizeId: true });

  if ((await readFence(sandbox)) !== screenAccess.fence) {
    return errorResponse(401, "Screen session has been revoked");
  }

  const proxyUrl = new URL(url);

  proxyUrl.searchParams.delete("access");
  const response = await proxyToSandbox(new Request(proxyUrl, request), { Sandbox: env.Computer });

  if (!response) {
    return errorResponse(404, "Screen not found");
  }

  const headers = new Headers(response.headers);

  if (url.searchParams.has("access")) {
    headers.append(
      "Set-Cookie",
      `computer_screen_access=${access}; Max-Age=${SCREEN_TTL_MS / 1000}; Path=/; Secure; HttpOnly; SameSite=Strict`,
    );
  }

  return createScreenWebSocketProxy(
    response,
    sandbox,
    screenAccess.fence,
    screenAccess.exp,
    headers,
    screenAccess.recordingId,
  );
}
