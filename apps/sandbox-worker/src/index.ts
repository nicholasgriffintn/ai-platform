import {
  NO_STORE,
  SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX,
  sandboxWorkerExecuteRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import {
  encodeServerSentEvent,
  encodeServerSentEventDone,
} from "@ngriffin_uk/polychat-utility-core";

import { verifySandboxJwt } from "./lib/auth";
import { SandboxCancellationError } from "./lib/cancellation";
import { handleSandboxPreviewRequest } from "./lib/preview-gateway";
import { buildSandboxRunUsageReport, reportSandboxRunUsage } from "./lib/usage-report";
import { executeSandboxTask } from "./tasks";
import type { TaskEvent, TaskParams, TaskResult, TaskSecrets, Env } from "./types";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": NO_STORE,
  Connection: "keep-alive",
} as const;

function isSafePolychatApiUrl(polychatApiUrl: string): boolean {
  try {
    const parsed = new URL(polychatApiUrl);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    if (parsed.username || parsed.password) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

function isSafeCredentialBrokerUrl(params: {
  baseUrl: string;
  polychatApiUrl: string;
  runId?: string;
}): boolean {
  if (!params.runId) {
    return false;
  }

  try {
    const api = new URL(params.polychatApiUrl);
    const broker = new URL(params.baseUrl);

    return (
      broker.origin === api.origin &&
      broker.username === "" &&
      broker.password === "" &&
      broker.pathname ===
        `${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/${encodeURIComponent(params.runId)}`
    );
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const previewResponse = await handleSandboxPreviewRequest(request, env);

    if (previewResponse) {
      return previewResponse;
    }

    const url = new URL(request.url);

    if (url.pathname !== "/execute") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    if (!env.JWT_SECRET?.trim()) {
      return Response.json(
        { error: "Sandbox authentication secret is not configured" },
        { status: 503 },
      );
    }

    if (!env.POLYCHAT_API) {
      return Response.json(
        { error: "Polychat API service binding is not configured" },
        { status: 503 },
      );
    }

    let params: TaskParams;

    try {
      const rawBody = await request.json();
      const parsedPayload = sandboxWorkerExecuteRequestSchema.safeParse(rawBody);

      if (!parsedPayload.success) {
        return Response.json({ error: "Invalid task payload" }, { status: 400 });
      }

      params = parsedPayload.data;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    const userToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!userToken) {
      return Response.json({ error: "Missing authorization token" }, { status: 401 });
    }

    let tokenUserId: number;

    try {
      const verified = await verifySandboxJwt(userToken, env.JWT_SECRET.trim());

      tokenUserId = verified.userId;
    } catch {
      return Response.json({ error: "Invalid sandbox authorization token" }, { status: 401 });
    }

    if (
      typeof params.userId === "number" &&
      Number.isFinite(params.userId) &&
      params.userId !== tokenUserId
    ) {
      return Response.json(
        { error: "Sandbox user does not match authorization token" },
        { status: 403 },
      );
    }

    params.userId = tokenUserId;

    params.taskType = params.taskType || "feature-implementation";

    const secrets: TaskSecrets = {
      userToken,
    };

    if (!isSafePolychatApiUrl(params.polychatApiUrl)) {
      return Response.json({ error: "Invalid task payload" }, { status: 400 });
    }

    if (
      !isSafeCredentialBrokerUrl({
        baseUrl: params.credentialBroker.baseUrl,
        polychatApiUrl: params.polychatApiUrl,
        runId: params.runId,
      })
    ) {
      return Response.json({ error: "Invalid credential broker" }, { status: 400 });
    }

    const executeTask = async (emitEvent?: (event: TaskEvent) => Promise<void> | void) => {
      const startedAtMs = Date.now();

      const emitTerminalEvent = async (result: TaskResult) => {
        const inspectionWindowSeconds = params.inspectionWindowSeconds ?? 0;
        const inspectionExpiresAt =
          inspectionWindowSeconds > 0
            ? new Date(Date.now() + inspectionWindowSeconds * 1000).toISOString()
            : undefined;

        if (result.success) {
          await emitEvent?.({
            type: "run_completed",
            runId: params.runId,
            completedAt: new Date().toISOString(),
            inspectionWindowSeconds: inspectionWindowSeconds || undefined,
            inspectionExpiresAt,
            inspectionExtended: false,
            result,
          });
        } else if (result.errorType === "cancelled") {
          await emitEvent?.({
            type: "run_cancelled",
            runId: params.runId,
            completedAt: new Date().toISOString(),
            message: result.error || "Sandbox run cancelled",
            result,
          });
        } else {
          await emitEvent?.({
            type: "run_failed",
            runId: params.runId,
            completedAt: new Date().toISOString(),
            inspectionWindowSeconds: inspectionWindowSeconds || undefined,
            inspectionExpiresAt,
            inspectionExtended: false,
            error: result.error || "Sandbox task failed",
            errorType: result.errorType,
            result,
          });
        }
      };

      try {
        return await executeSandboxTask(
          params,
          secrets,
          env,
          emitEvent,
          request.signal,
          emitTerminalEvent,
        );
      } finally {
        if (params.runId) {
          await reportSandboxRunUsage({
            polychatApi: env.POLYCHAT_API,
            userToken: secrets.userToken,
            report: buildSandboxRunUsageReport({
              runId: params.runId,
              userId: tokenUserId,
              instanceType: env.SANDBOX_INSTANCE_TYPE,
              startedAtMs,
              endedAtMs: Date.now(),
            }),
          });
        }
      }
    };

    const wantsStream = request.headers.get("accept")?.includes("text/event-stream");

    if (!wantsStream) {
      try {
        return Response.json(await executeTask());
      } catch (error) {
        return Response.json(
          {
            error: error instanceof Error ? error.message : "Unknown task execution error",
          },
          { status: 400 },
        );
      }
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let streamClosed = false;
        const safeEnqueue = (chunk: Uint8Array): boolean => {
          if (streamClosed) {
            return false;
          }

          try {
            controller.enqueue(chunk);

            return true;
          } catch {
            streamClosed = true;

            return false;
          }
        };

        const closeStream = () => {
          if (streamClosed) {
            return;
          }

          streamClosed = true;
          try {
            controller.enqueue(encodeServerSentEventDone());
            controller.close();
          } catch {
            // Client disconnected before the terminal SSE frame could be sent.
          }
        };

        let terminalEventEmitted = false;

        const emitEvent = (event: TaskEvent) => {
          if (
            event.type === "run_completed" ||
            event.type === "run_cancelled" ||
            event.type === "run_failed"
          ) {
            terminalEventEmitted = true;
          }

          safeEnqueue(
            encodeServerSentEvent({
              ...event,
              runId: event.runId ?? params.runId,
            }),
          );
        };

        emitEvent({
          type: "run_started",
          runId: params.runId,
          repo: params.repo,
          installationId: params.installationId,
          startedAt: new Date().toISOString(),
          timeoutSeconds: params.timeoutSeconds,
        });

        try {
          const result = await executeTask(emitEvent);

          if (!terminalEventEmitted && result.success) {
            emitEvent({
              type: "run_completed",
              runId: params.runId,
              completedAt: new Date().toISOString(),
              result,
            });
          } else if (!terminalEventEmitted && result.errorType === "cancelled") {
            emitEvent({
              type: "run_cancelled",
              runId: params.runId,
              completedAt: new Date().toISOString(),
              message: result.error || "Sandbox run cancelled",
              result,
            });
          } else if (!terminalEventEmitted) {
            emitEvent({
              type: "run_failed",
              runId: params.runId,
              completedAt: new Date().toISOString(),
              error: result.error || "Sandbox task failed",
              errorType: result.errorType,
              result,
            });
          }
        } catch (error) {
          if (error instanceof SandboxCancellationError || request.signal.aborted) {
            emitEvent({
              type: "run_cancelled",
              runId: params.runId,
              completedAt: new Date().toISOString(),
              message: error instanceof Error ? error.message : "Sandbox run cancelled",
            });
            closeStream();

            return;
          }

          emitEvent({
            type: "run_failed",
            runId: params.runId,
            completedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Unknown task execution error",
          });
        } finally {
          closeStream();
        }
      },
    });

    return new Response(stream, {
      headers: SSE_HEADERS,
    });
  },
};

export { Sandbox } from "@cloudflare/sandbox";
