import {
  sandboxRunDispatchMessageSchema,
  sandboxRunControlSchema,
  sandboxRunInstructionKindSchema,
  sandboxPreviewIdSchema,
  sandboxPreviewConsumeRequestSchema,
  sandboxPreviewSessionRecordSchema,
  sandboxServiceActionSchema,
  sandboxServiceNameSchema,
  type SandboxRunDispatchMessage,
  type SandboxRunEvent,
  type SandboxRunInstruction,
  type SandboxPreviewSessionRecord,
  NO_STORE,
} from "@ngriffin_uk/polychat-schemas";
import { Agent, type FiberContext, type FiberRecoveryContext } from "agents";

import type { IEnv } from "~/types";
import { safeParseJson } from "~/utils/json";

import {
  parseSandboxDispatchRecoveryMessage,
  SANDBOX_RUN_DISPATCH_FIBER_NAME,
  type SandboxDispatchFiberSnapshot,
} from "./fibers";
import type {
  CoordinatorEventEnvelope,
  CoordinatorInstructionEnvelope,
  CoordinatorState,
  SandboxRunInstructionRecord,
} from "./types";

const CONTROL_KEY = "control";
const EVENTS_KEY = "events";
const EVENT_INDEX_KEY = "event-index";
const INSTRUCTIONS_KEY = "instructions";
const INSTRUCTION_INDEX_KEY = "instruction-index";
const PREVIEW_SESSION_PREFIX = "preview-session:";
const MAX_ACTIVE_PREVIEW_SESSIONS = 16;
const DEFAULT_APPROVAL_TIMEOUT_SECONDS = 120;
const DEFAULT_APPROVAL_ESCALATE_AFTER_SECONDS = 30;
const MIN_APPROVAL_TIMEOUT_SECONDS = 5;
const MAX_APPROVAL_TIMEOUT_SECONDS = 1800;
const MIN_APPROVAL_ESCALATE_SECONDS = 1;
const MAX_APPROVAL_ESCALATE_SECONDS = 900;
const APPROVAL_TIMEOUT_REASON = "Approval request timed out";

function parsePositiveInt(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }

  if (value < min || value > max) {
    return undefined;
  }

  return value;
}

function addSecondsIso(isoTimestamp: string, seconds: number): string {
  return new Date(Date.parse(isoTimestamp) + seconds * 1000).toISOString();
}

function isInstructionReplay(
  instruction: SandboxRunInstruction,
  body: Record<string, unknown>,
): boolean {
  const content = typeof body.content === "string" ? body.content.trim() || undefined : undefined;
  const command = typeof body.command === "string" ? body.command.trim() || undefined : undefined;
  const requestId =
    typeof body.requestId === "string" ? body.requestId.trim() || undefined : undefined;
  const serviceName =
    typeof body.serviceName === "string" ? body.serviceName.trim() || undefined : undefined;
  const serviceAction =
    typeof body.serviceAction === "string" ? body.serviceAction.trim() || undefined : undefined;

  return (
    instruction.kind === body.kind &&
    instruction.content === content &&
    instruction.command === command &&
    instruction.requestId === requestId &&
    instruction.serviceName === serviceName &&
    instruction.serviceAction === serviceAction &&
    instruction.createdByUserId === body.createdByUserId &&
    (instruction.kind !== "approval_response" || instruction.approvalStatus === body.approvalStatus)
  );
}

export class SandboxRunCoordinator extends Agent<IEnv> {
  private get storage(): DurableObjectStorage {
    return this.ctx.storage;
  }

  private broadcastEnvelope(envelope: CoordinatorEventEnvelope): void {
    const payload = JSON.stringify(envelope);

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        try {
          socket.close(1011, "Coordinator broadcast failed");
        } catch {
          // Ignore socket close failures.
        }
      }
    }
  }

  private async getControl(): Promise<CoordinatorState | null> {
    const raw = await this.storage.get<string>(CONTROL_KEY);

    if (!raw) {
      return null;
    }

    const parsed = safeParseJson<unknown>(raw);
    const valid = sandboxRunControlSchema.safeParse(parsed);

    return valid.success ? valid.data : null;
  }

  private async putControl(control: CoordinatorState): Promise<void> {
    await this.storage.put(CONTROL_KEY, JSON.stringify(control));
  }

  private async appendEvent(event: SandboxRunEvent): Promise<CoordinatorEventEnvelope> {
    const currentIndex = (await this.storage.get<number>(EVENT_INDEX_KEY)) ?? 0;
    const nextIndex = currentIndex + 1;
    const envelope: CoordinatorEventEnvelope = {
      index: nextIndex,
      event,
      recordedAt: new Date().toISOString(),
    };

    const raw = await this.storage.get<string>(EVENTS_KEY);
    const existing = raw ? (safeParseJson<CoordinatorEventEnvelope[]>(raw) ?? []) : [];
    const nextEvents = [...existing, envelope].slice(-500);

    await this.storage.put(EVENT_INDEX_KEY, nextIndex);
    await this.storage.put(EVENTS_KEY, JSON.stringify(nextEvents));

    if (
      event.type === "run_completed" ||
      event.type === "run_failed" ||
      event.type === "run_cancelled"
    ) {
      await this.revokePreviewSessions();
    } else if (event.serviceName && event.serviceStatus && event.serviceStatus !== "healthy") {
      await this.revokePreviewSessions(event.serviceName);
    }

    this.broadcastEnvelope(envelope);

    return envelope;
  }

  private async appendInstruction(
    instruction: SandboxRunInstructionRecord,
  ): Promise<CoordinatorInstructionEnvelope> {
    const currentIndex = (await this.storage.get<number>(INSTRUCTION_INDEX_KEY)) ?? 0;
    const nextIndex = currentIndex + 1;
    const envelope: CoordinatorInstructionEnvelope = {
      index: nextIndex,
      instruction,
      recordedAt: new Date().toISOString(),
    };

    const raw = await this.storage.get<string>(INSTRUCTIONS_KEY);
    const existing = raw ? (safeParseJson<CoordinatorInstructionEnvelope[]>(raw) ?? []) : [];
    const nextInstructions = [...existing, envelope].slice(-500);

    await this.storage.put(INSTRUCTION_INDEX_KEY, nextIndex);
    await this.storage.put(INSTRUCTIONS_KEY, JSON.stringify(nextInstructions));

    return envelope;
  }

  private async getInstructions(): Promise<CoordinatorInstructionEnvelope[]> {
    const raw = await this.storage.get<string>(INSTRUCTIONS_KEY);

    return raw ? (safeParseJson<CoordinatorInstructionEnvelope[]>(raw) ?? []) : [];
  }

  private async putInstructions(instructions: CoordinatorInstructionEnvelope[]): Promise<void> {
    await this.storage.put(INSTRUCTIONS_KEY, JSON.stringify(instructions.slice(-500)));
  }

  private async getPreviewSession(previewId: string): Promise<SandboxPreviewSessionRecord | null> {
    const raw = await this.storage.get<string>(`${PREVIEW_SESSION_PREFIX}${previewId}`);

    if (!raw) {
      return null;
    }

    const parsed = sandboxPreviewSessionRecordSchema.safeParse(safeParseJson(raw));

    return parsed.success ? parsed.data : null;
  }

  private async putPreviewSession(session: SandboxPreviewSessionRecord): Promise<void> {
    await this.storage.put(
      `${PREVIEW_SESSION_PREFIX}${session.previewId}`,
      JSON.stringify(session),
    );
  }

  private async revokePreviewSessions(serviceName?: string): Promise<void> {
    const stored = await this.storage.list<string>({ prefix: PREVIEW_SESSION_PREFIX });
    const revokedAt = new Date().toISOString();

    await Promise.all(
      [...stored].map(async ([key, raw]) => {
        const parsed = sandboxPreviewSessionRecordSchema.safeParse(safeParseJson(raw));

        if (
          !parsed.success ||
          parsed.data.revokedAt ||
          (serviceName && parsed.data.serviceName !== serviceName)
        ) {
          return;
        }

        await this.storage.put(key, JSON.stringify({ ...parsed.data, revokedAt }));
      }),
    );
  }

  private applyInstructionLifecycleTransitions(
    instructions: CoordinatorInstructionEnvelope[],
    now: Date = new Date(),
  ): {
    instructions: CoordinatorInstructionEnvelope[];
    changed: boolean;
  } {
    let changed = false;
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const nextInstructions = instructions.map((entry) => {
      const instruction = entry.instruction;

      if (instruction.kind !== "approval_request") {
        return entry;
      }

      if (
        instruction.approvalStatus === "approved" ||
        instruction.approvalStatus === "rejected" ||
        instruction.approvalStatus === "timed_out"
      ) {
        return entry;
      }

      let nextInstruction = instruction;

      if (
        instruction.approvalStatus === "pending" &&
        instruction.escalationAt &&
        Date.parse(instruction.escalationAt) <= nowMs
      ) {
        nextInstruction = {
          ...nextInstruction,
          approvalStatus: "escalated",
          escalatedAt: nextInstruction.escalatedAt ?? nowIso,
        };
        changed = true;
      }

      if (
        (nextInstruction.approvalStatus === "pending" ||
          nextInstruction.approvalStatus === "escalated") &&
        nextInstruction.expiresAt &&
        Date.parse(nextInstruction.expiresAt) <= nowMs
      ) {
        nextInstruction = {
          ...nextInstruction,
          approvalStatus: "timed_out",
          timedOutAt: nextInstruction.timedOutAt ?? nowIso,
          resolvedAt: nextInstruction.resolvedAt ?? nowIso,
          resolutionReason: nextInstruction.resolutionReason ?? APPROVAL_TIMEOUT_REASON,
        };
        changed = true;
      }

      return {
        ...entry,
        instruction: nextInstruction,
      };
    });

    return {
      instructions: nextInstructions,
      changed,
    };
  }

  private async getInstructionsWithLifecycle(): Promise<CoordinatorInstructionEnvelope[]> {
    const instructions = await this.getInstructions();
    const transitioned = this.applyInstructionLifecycleTransitions(instructions);

    if (transitioned.changed) {
      await this.putInstructions(transitioned.instructions);
    }

    return transitioned.instructions;
  }

  private async executeDispatchFiber(
    message: SandboxRunDispatchMessage,
    fiberContext?: Pick<FiberContext, "stash">,
  ): Promise<void> {
    const stash = (phase: SandboxDispatchFiberSnapshot["phase"], error?: string) => {
      fiberContext?.stash({
        message,
        phase,
        updatedAt: new Date().toISOString(),
        ...(error ? { error } : {}),
      } satisfies SandboxDispatchFiberSnapshot);
    };

    stash("running");
    try {
      const { processSandboxRunDispatch } = await import("../dispatch");

      await processSandboxRunDispatch({
        env: this.env,
        message,
      });
      stash("completed");
    } catch (error) {
      stash("error", error instanceof Error ? error.message : "Sandbox dispatch failed");
      throw error;
    }
  }

  private async startDispatchFiber(message: SandboxRunDispatchMessage) {
    return this.startFiber(
      SANDBOX_RUN_DISPATCH_FIBER_NAME,
      async (fiberContext) => {
        await this.executeDispatchFiber(message, fiberContext);
      },
      {
        idempotencyKey: message.runId,
        metadata: { message },
        waitForCompletion: false,
      },
    );
  }

  public override async onFiberRecovered(
    context: FiberRecoveryContext,
  ): Promise<{ status: "completed" } | { status: "error"; error: string } | void> {
    if (context.name !== SANDBOX_RUN_DISPATCH_FIBER_NAME) {
      return;
    }

    const message = parseSandboxDispatchRecoveryMessage(context);

    if (!message) {
      return {
        status: "error",
        error: "Recovered sandbox dispatch fiber is missing a valid message",
      };
    }

    try {
      await this.executeDispatchFiber(message);

      return { status: "completed" };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Recovered sandbox dispatch failed",
      };
    }
  }

  public override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/dispatch/fiber" && request.method === "POST") {
      const payload = await request.json();
      const parsed = sandboxRunDispatchMessageSchema.safeParse(payload);

      if (!parsed.success) {
        return Response.json({ error: "Invalid sandbox dispatch payload" }, { status: 400 });
      }

      const result = await this.startDispatchFiber(parsed.data);

      return Response.json(result);
    }

    if (
      pathname === "/events/ws" &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      this.ctx.acceptWebSocket(server);
      server.send(
        JSON.stringify({
          type: "ready",
          recordedAt: new Date().toISOString(),
        }),
      );

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          "Cache-Control": NO_STORE,
        },
      });
    }

    if (pathname === "/control" && request.method === "GET") {
      const control = await this.getControl();

      if (!control) {
        return Response.json({ error: "Control state not initialised" }, { status: 404 });
      }

      return Response.json(control);
    }

    if (pathname === "/control/init" && request.method === "POST") {
      const payload = await request.json();
      const parsed = sandboxRunControlSchema.safeParse(payload);

      if (!parsed.success) {
        return Response.json({ error: "Invalid control payload" }, { status: 400 });
      }

      await this.putControl(parsed.data);

      return Response.json({ success: true });
    }

    if (pathname === "/control/update" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, unknown>;

      return this.ctx.blockConcurrencyWhile(async () => {
        const existing = await this.getControl();

        if (!existing) {
          return Response.json({ error: "Control state not initialised" }, { status: 404 });
        }

        if (
          typeof payload.expectedUpdatedAt === "string" &&
          payload.expectedUpdatedAt !== existing.updatedAt
        ) {
          return Response.json({ error: "Control state has changed" }, { status: 409 });
        }

        const nextState =
          payload.state === "queued" ||
          payload.state === "running" ||
          payload.state === "paused" ||
          payload.state === "cancelled"
            ? payload.state
            : undefined;
        const next: CoordinatorState = {
          ...existing,
          ...(nextState ? { state: nextState } : {}),
          ...(typeof payload.updatedAt === "string"
            ? { updatedAt: payload.updatedAt }
            : { updatedAt: new Date().toISOString() }),
          ...(typeof payload.cancellationReason === "string"
            ? { cancellationReason: payload.cancellationReason }
            : {}),
          ...(typeof payload.pauseReason === "string" ? { pauseReason: payload.pauseReason } : {}),
          ...(typeof payload.timeoutSeconds === "number"
            ? { timeoutSeconds: payload.timeoutSeconds }
            : {}),
          ...(typeof payload.timeoutAt === "string" ? { timeoutAt: payload.timeoutAt } : {}),
        };
        const validated = sandboxRunControlSchema.safeParse(next);

        if (!validated.success) {
          return Response.json({ error: "Invalid control update payload" }, { status: 400 });
        }

        await this.putControl(validated.data);

        return Response.json(validated.data);
      });
    }

    if (pathname === "/events" && request.method === "POST") {
      const event = (await request.json()) as SandboxRunEvent;

      return Response.json(await this.ctx.blockConcurrencyWhile(() => this.appendEvent(event)));
    }

    if (pathname === "/events" && request.method === "GET") {
      const afterRaw = url.searchParams.get("after");
      const after = afterRaw ? Number.parseInt(afterRaw, 10) : 0;
      const raw = await this.storage.get<string>(EVENTS_KEY);
      const events = raw ? (safeParseJson<CoordinatorEventEnvelope[]>(raw) ?? []) : [];

      return Response.json({
        events: events.filter((entry) => entry.index > (Number.isFinite(after) ? after : 0)),
      });
    }

    if (pathname === "/previews" && request.method === "POST") {
      const parsed = sandboxPreviewSessionRecordSchema.safeParse(
        await request.json().catch(() => undefined),
      );

      if (!parsed.success) {
        return Response.json({ error: "Invalid preview session" }, { status: 400 });
      }

      return this.ctx.blockConcurrencyWhile(async () => {
        const existing = await this.getPreviewSession(parsed.data.previewId);

        if (existing) {
          return Response.json({ error: "Preview session already exists" }, { status: 409 });
        }

        const stored = await this.storage.list<string>({ prefix: PREVIEW_SESSION_PREFIX });
        const expiredKeys: string[] = [];
        let activeSessions = 0;

        for (const [key, raw] of stored) {
          const candidate = sandboxPreviewSessionRecordSchema.safeParse(safeParseJson(raw));

          if (
            !candidate.success ||
            candidate.data.revokedAt ||
            Date.parse(candidate.data.expiresAt) <= Date.now()
          ) {
            expiredKeys.push(key);
          } else {
            activeSessions += 1;
          }
        }

        if (expiredKeys.length > 0) {
          await this.storage.delete(expiredKeys);
        }

        if (activeSessions >= MAX_ACTIVE_PREVIEW_SESSIONS) {
          return Response.json({ error: "Preview session limit reached" }, { status: 429 });
        }

        await this.putPreviewSession(parsed.data);

        return Response.json({ session: parsed.data });
      });
    }

    const previewPath = /^\/previews\/([^/]+)(?:\/(consume|revoke))?$/.exec(pathname);

    if (previewPath) {
      const parsedPreviewId = sandboxPreviewIdSchema.safeParse(previewPath[1]);

      if (!parsedPreviewId.success) {
        return Response.json({ error: "Invalid preview session" }, { status: 400 });
      }

      const previewId = parsedPreviewId.data;
      const operation = previewPath[2];

      if (!operation && request.method === "GET") {
        const session = await this.getPreviewSession(previewId);

        return session
          ? Response.json({ session })
          : Response.json({ error: "Preview session not found" }, { status: 404 });
      }

      if (operation === "consume" && request.method === "POST") {
        const parsedPayload = sandboxPreviewConsumeRequestSchema.safeParse(
          await request.json().catch(() => undefined),
        );

        if (!parsedPayload.success) {
          return Response.json({ error: "Preview bootstrap is invalid" }, { status: 400 });
        }

        return this.ctx.blockConcurrencyWhile(async () => {
          const session = await this.getPreviewSession(previewId);

          if (!session) {
            return Response.json({ error: "Preview session not found" }, { status: 404 });
          }

          if (parsedPayload.data.bootstrapJti !== session.bootstrapJti) {
            return Response.json({ error: "Preview bootstrap is invalid" }, { status: 401 });
          }

          if (session.bootstrapConsumedAt) {
            return Response.json({ error: "Preview bootstrap was already used" }, { status: 409 });
          }

          if (session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) {
            return Response.json({ error: "Preview session expired" }, { status: 410 });
          }

          const consumed = {
            ...session,
            bootstrapConsumedAt: new Date().toISOString(),
          };

          await this.putPreviewSession(consumed);

          return Response.json({ session: consumed });
        });
      }

      if (operation === "revoke" && request.method === "POST") {
        return this.ctx.blockConcurrencyWhile(async () => {
          const session = await this.getPreviewSession(previewId);

          if (!session) {
            return Response.json({ revoked: true });
          }

          if (!session.revokedAt) {
            await this.putPreviewSession({
              ...session,
              revokedAt: new Date().toISOString(),
            });
          }

          return Response.json({ revoked: true });
        });
      }
    }

    if (pathname === "/instructions" && request.method === "POST") {
      const body = (await request.json()) as Record<string, unknown>;

      return this.ctx.blockConcurrencyWhile(async () => {
        const parsedKind = sandboxRunInstructionKindSchema.safeParse(body.kind);

        if (!parsedKind.success) {
          return Response.json({ error: "Instruction kind is invalid" }, { status: 400 });
        }

        const kind = parsedKind.data;
        const contentRaw = typeof body.content === "string" ? body.content.trim() : "";
        const idempotencyKey =
          typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
        const createdByUserId = parsePositiveInt(body.createdByUserId, 1, Number.MAX_SAFE_INTEGER);

        if (idempotencyKey) {
          const instructions = await this.getInstructionsWithLifecycle();
          const existing = instructions.find(
            (entry) => entry.instruction.idempotencyKey === idempotencyKey,
          );

          if (existing) {
            if (!isInstructionReplay(existing.instruction, { ...body, kind })) {
              return Response.json(
                { error: "Idempotency key was already used for another instruction" },
                { status: 409 },
              );
            }

            return Response.json({
              instruction: existing.instruction,
              envelope: existing,
              replayed: true,
            });
          }
        }

        if (kind === "message" && !contentRaw) {
          return Response.json(
            { error: "content is required for message instructions" },
            { status: 400 },
          );
        }

        const parsedServiceName = sandboxServiceNameSchema.safeParse(body.serviceName);
        const parsedServiceAction = sandboxServiceActionSchema.safeParse(body.serviceAction);

        if (
          kind === "service_action" &&
          (!parsedServiceName.success || !parsedServiceAction.success)
        ) {
          return Response.json(
            { error: "serviceName and serviceAction are required for service controls" },
            { status: 400 },
          );
        }

        const control = await this.getControl();
        const nowIso = new Date().toISOString();

        if (control?.state === "cancelled") {
          return Response.json({ error: "Run no longer accepts instructions" }, { status: 409 });
        }

        if (kind === "approval_request") {
          const command = typeof body.command === "string" ? body.command.trim() : "";

          if (!command) {
            return Response.json({ error: "command is required" }, { status: 400 });
          }

          const timeoutSeconds =
            parsePositiveInt(
              body.timeoutSeconds,
              MIN_APPROVAL_TIMEOUT_SECONDS,
              MAX_APPROVAL_TIMEOUT_SECONDS,
            ) ?? DEFAULT_APPROVAL_TIMEOUT_SECONDS;
          const requestedEscalateAfterSeconds = parsePositiveInt(
            body.escalateAfterSeconds,
            MIN_APPROVAL_ESCALATE_SECONDS,
            MAX_APPROVAL_ESCALATE_SECONDS,
          );
          const escalateAfterSeconds = Math.min(
            requestedEscalateAfterSeconds ?? DEFAULT_APPROVAL_ESCALATE_AFTER_SECONDS,
            Math.max(1, timeoutSeconds - 1),
          );
          const instruction: SandboxRunInstruction = {
            id: crypto.randomUUID(),
            idempotencyKey: idempotencyKey || undefined,
            runId: control?.runId ?? "unknown",
            kind,
            content: contentRaw || undefined,
            command,
            approvalStatus: "pending",
            timeoutSeconds,
            escalateAfterSeconds,
            expiresAt: addSecondsIso(nowIso, timeoutSeconds),
            escalationAt: addSecondsIso(nowIso, escalateAfterSeconds),
            createdByUserId,
            createdAt: nowIso,
          };
          const envelope = await this.appendInstruction(instruction);

          return Response.json({ instruction: envelope.instruction, envelope });
        }

        if (kind === "approval_response") {
          const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
          const approvalStatus =
            body.approvalStatus === "approved" || body.approvalStatus === "rejected"
              ? body.approvalStatus
              : undefined;

          if (!requestId || !approvalStatus) {
            return Response.json(
              { error: "requestId and approvalStatus are required" },
              { status: 400 },
            );
          }

          const instructions = await this.getInstructionsWithLifecycle();
          const requestIndex = instructions.findIndex(
            (entry) =>
              entry.instruction.kind === "approval_request" && entry.instruction.id === requestId,
          );

          if (requestIndex < 0) {
            return Response.json({ error: "Approval request not found" }, { status: 404 });
          }

          const requestInstruction = instructions[requestIndex].instruction;

          if (
            requestInstruction.approvalStatus === "approved" ||
            requestInstruction.approvalStatus === "rejected" ||
            requestInstruction.approvalStatus === "timed_out"
          ) {
            return Response.json({ error: "Approval request already resolved" }, { status: 409 });
          }

          instructions[requestIndex] = {
            ...instructions[requestIndex],
            instruction: {
              ...requestInstruction,
              approvalStatus,
              resolvedAt: nowIso,
              resolutionReason: contentRaw || requestInstruction.resolutionReason,
            },
          };
          await this.putInstructions(instructions);

          const instruction: SandboxRunInstruction = {
            id: crypto.randomUUID(),
            idempotencyKey: idempotencyKey || undefined,
            runId: control?.runId ?? "unknown",
            kind,
            requestId,
            approvalStatus,
            content: contentRaw || undefined,
            createdByUserId,
            createdAt: nowIso,
          };
          const envelope = await this.appendInstruction(instruction);

          return Response.json({ instruction: envelope.instruction, envelope });
        }

        const instruction: SandboxRunInstruction = {
          id: crypto.randomUUID(),
          idempotencyKey: idempotencyKey || undefined,
          runId: control?.runId ?? "unknown",
          kind,
          content: contentRaw || undefined,
          serviceName:
            kind === "service_action" && parsedServiceName.success
              ? parsedServiceName.data
              : undefined,
          serviceAction:
            kind === "service_action" && parsedServiceAction.success
              ? parsedServiceAction.data
              : undefined,
          createdByUserId,
          createdAt: nowIso,
        };
        const envelope = await this.appendInstruction(instruction);

        return Response.json({ instruction: envelope.instruction, envelope });
      });
    }

    if (pathname === "/instructions" && request.method === "GET") {
      const afterRaw = url.searchParams.get("after");
      const after = afterRaw ? Number.parseInt(afterRaw, 10) : 0;
      const instructions = await this.getInstructionsWithLifecycle();

      return Response.json({
        instructions: instructions.filter(
          (entry) => entry.index > (Number.isFinite(after) ? after : 0),
        ),
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  public override async webSocketMessage(
    _ws: WebSocket,
    _message: ArrayBuffer | string,
  ): Promise<void> {
    // Inbound messages are currently ignored; websocket clients subscribe-only.
  }

  public override async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close(1000, "Closed");
    } catch {
      // Ignore close errors.
    }
  }
}
