import {
  sandboxPreviewSessionRecordSchema,
  sandboxRunControlSchema,
  type SandboxRunDispatchMessage,
  sandboxRunInstructionEnvelopeSchema,
  sandboxRunInstructionSchema,
  type SandboxRunControl,
  type SandboxRunEvent,
  type SandboxRunInstruction,
  type SandboxRunInstructionKind,
  type SandboxServiceAction,
  type SandboxPreviewSessionRecord,
} from "@ngriffin_uk/polychat-schemas";
import type { StartFiberResult } from "agents";

import {
  getDurableObjectStub,
  postDurableObjectJson,
  readDurableObjectJson,
} from "~/lib/durable-objects/client";
import { addInfraUsage } from "~/lib/usage/requestMeter";
import type { IEnv } from "~/types";

import { isStartFiberResult } from "./fibers";
import type { CoordinatorEventEnvelope, CoordinatorInstructionEnvelope } from "./types";

function getCoordinatorStub(env: IEnv | undefined, runId: string): DurableObjectStub {
  const stub = getDurableObjectStub(env?.SANDBOX_RUN_COORDINATOR, runId);

  if (!stub) {
    throw new Error("SANDBOX_RUN_COORDINATOR binding is not configured");
  }

  return stub;
}

export async function initRunCoordinatorControl(
  env: IEnv | undefined,
  control: SandboxRunControl,
): Promise<void> {
  if (!env?.SANDBOX_RUN_COORDINATOR) {
    return;
  }

  const stub = getCoordinatorStub(env, control.runId);

  await postDurableObjectJson(stub, "https://sandbox-run-coordinator/control/init", control);
}

export async function startRunCoordinatorDispatchFiber(params: {
  env: IEnv | undefined;
  runId: string;
  message: SandboxRunDispatchMessage;
}): Promise<StartFiberResult | null> {
  if (!params.env?.SANDBOX_RUN_COORDINATOR) {
    return null;
  }

  const stub = getCoordinatorStub(params.env, params.runId);
  const response = await postDurableObjectJson(
    stub,
    "https://sandbox-run-coordinator/dispatch/fiber",
    params.message,
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();

  return isStartFiberResult(payload) ? payload : null;
}

export async function updateRunCoordinatorControl(params: {
  env: IEnv | undefined;
  runId: string;
  state?: SandboxRunControl["state"];
  updatedAt?: string;
  cancellationReason?: string;
  pauseReason?: string;
  timeoutSeconds?: number;
  timeoutAt?: string;
  expectedUpdatedAt?: string;
}): Promise<SandboxRunControl | null> {
  if (!params.env?.SANDBOX_RUN_COORDINATOR) {
    return null;
  }

  const stub = getCoordinatorStub(params.env, params.runId);
  const response = await postDurableObjectJson(
    stub,
    "https://sandbox-run-coordinator/control/update",
    {
      state: params.state,
      updatedAt: params.updatedAt,
      cancellationReason: params.cancellationReason,
      pauseReason: params.pauseReason,
      timeoutSeconds: params.timeoutSeconds,
      timeoutAt: params.timeoutAt,
      expectedUpdatedAt: params.expectedUpdatedAt,
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const parsed = sandboxRunControlSchema.safeParse(payload);

  return parsed.success ? parsed.data : null;
}

export async function getRunCoordinatorControl(
  env: IEnv | undefined,
  runId: string,
): Promise<SandboxRunControl | null> {
  if (!env?.SANDBOX_RUN_COORDINATOR) {
    return null;
  }

  const stub = getCoordinatorStub(env, runId);
  const response = await readDurableObjectJson(stub, "https://sandbox-run-coordinator/control");

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const parsed = sandboxRunControlSchema.safeParse(payload);

  return parsed.success ? parsed.data : null;
}

export async function appendRunCoordinatorEvent(params: {
  env: IEnv | undefined;
  runId: string;
  event: SandboxRunEvent;
}): Promise<void> {
  if (!params.env?.SANDBOX_RUN_COORDINATOR) {
    return;
  }

  const stub = getCoordinatorStub(params.env, params.runId);

  await postDurableObjectJson(stub, "https://sandbox-run-coordinator/events", params.event);
}

export async function listRunCoordinatorEvents(params: {
  env: IEnv | undefined;
  runId: string;
  after?: number;
}): Promise<CoordinatorEventEnvelope[]> {
  if (!params.env?.SANDBOX_RUN_COORDINATOR) {
    return [];
  }

  const stub = getCoordinatorStub(params.env, params.runId);
  const url = new URL("https://sandbox-run-coordinator/events");

  if (typeof params.after === "number" && Number.isFinite(params.after)) {
    url.searchParams.set("after", String(params.after));
  }

  const response = await readDurableObjectJson(stub, url.toString());

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    events?: CoordinatorEventEnvelope[];
  };

  return Array.isArray(payload.events) ? payload.events : [];
}

export async function openRunCoordinatorEventsSocket(params: {
  env: IEnv | undefined;
  runId: string;
}): Promise<WebSocket | null> {
  if (!params.env?.SANDBOX_RUN_COORDINATOR) {
    return null;
  }

  const stub = getCoordinatorStub(params.env, params.runId);

  addInfraUsage("do_requests", 1);

  const response = await stub.fetch("https://sandbox-run-coordinator/events/ws", {
    headers: {
      Upgrade: "websocket",
    },
  });

  const socket = response.webSocket;

  if (!socket) {
    return null;
  }

  socket.accept();

  return socket;
}

export async function submitRunCoordinatorInstruction(params: {
  env: IEnv | undefined;
  runId: string;
  kind: SandboxRunInstructionKind;
  idempotencyKey?: string;
  content?: string;
  command?: string;
  requestId?: string;
  approvalStatus?: "approved" | "rejected";
  serviceName?: string;
  serviceAction?: SandboxServiceAction;
  timeoutSeconds?: number;
  escalateAfterSeconds?: number;
  createdByUserId?: number;
}): Promise<
  | { ok: true; instruction: SandboxRunInstruction; replayed: boolean }
  | { ok: false; status: number; error: string }
  | null
> {
  if (!params.env?.SANDBOX_RUN_COORDINATOR) {
    return null;
  }

  const stub = getCoordinatorStub(params.env, params.runId);
  const response = await postDurableObjectJson(
    stub,
    "https://sandbox-run-coordinator/instructions",
    {
      kind: params.kind,
      idempotencyKey: params.idempotencyKey,
      content: params.content,
      command: params.command,
      requestId: params.requestId,
      approvalStatus: params.approvalStatus,
      serviceName: params.serviceName,
      serviceAction: params.serviceAction,
      timeoutSeconds: params.timeoutSeconds,
      escalateAfterSeconds: params.escalateAfterSeconds,
      createdByUserId: params.createdByUserId,
    },
  );

  const payload = (await response.json()) as {
    instruction?: unknown;
    replayed?: unknown;
    error?: unknown;
  };

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: typeof payload.error === "string" ? payload.error : "Run instruction was not accepted",
    };
  }

  const parsed = sandboxRunInstructionSchema.safeParse(payload.instruction);

  return parsed.success
    ? { ok: true, instruction: parsed.data, replayed: payload.replayed === true }
    : { ok: false, status: 502, error: "Run instruction response was invalid" };
}

export async function listRunCoordinatorInstructions(params: {
  env: IEnv | undefined;
  runId: string;
  after?: number;
}): Promise<CoordinatorInstructionEnvelope[]> {
  if (!params.env?.SANDBOX_RUN_COORDINATOR) {
    return [];
  }

  const stub = getCoordinatorStub(params.env, params.runId);
  const url = new URL("https://sandbox-run-coordinator/instructions");

  if (typeof params.after === "number" && Number.isFinite(params.after)) {
    url.searchParams.set("after", String(params.after));
  }

  const response = await readDurableObjectJson(stub, url.toString());

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    instructions?: unknown[];
  };

  if (!Array.isArray(payload.instructions)) {
    return [];
  }

  const instructions: CoordinatorInstructionEnvelope[] = [];

  for (const entry of payload.instructions) {
    const parsed = sandboxRunInstructionEnvelopeSchema.safeParse(entry);

    if (parsed.success) {
      instructions.push(parsed.data);
    }
  }

  return instructions;
}

function parsePreviewSessionPayload(payload: unknown): SandboxPreviewSessionRecord | null {
  if (!payload || typeof payload !== "object" || !("session" in payload)) {
    return null;
  }

  const parsed = sandboxPreviewSessionRecordSchema.safeParse(payload.session);

  return parsed.success ? parsed.data : null;
}

export async function createRunCoordinatorPreviewSession(params: {
  env: IEnv | undefined;
  runId: string;
  session: SandboxPreviewSessionRecord;
}): Promise<boolean> {
  const stub = getCoordinatorStub(params.env, params.runId);
  const response = await postDurableObjectJson(
    stub,
    "https://sandbox-run-coordinator/previews",
    params.session,
  );

  return response.ok;
}

export async function getRunCoordinatorPreviewSession(params: {
  env: IEnv | undefined;
  previewId: string;
  runId: string;
}): Promise<SandboxPreviewSessionRecord | null> {
  const stub = getCoordinatorStub(params.env, params.runId);
  const response = await readDurableObjectJson(
    stub,
    `https://sandbox-run-coordinator/previews/${encodeURIComponent(params.previewId)}`,
  );

  if (!response.ok) {
    return null;
  }

  return parsePreviewSessionPayload(await response.json());
}

export async function consumeRunCoordinatorPreviewSession(params: {
  bootstrapJti: string;
  env: IEnv | undefined;
  previewId: string;
  runId: string;
}): Promise<{ ok: true; session: SandboxPreviewSessionRecord } | { ok: false; status: number }> {
  const stub = getCoordinatorStub(params.env, params.runId);
  const response = await postDurableObjectJson(
    stub,
    `https://sandbox-run-coordinator/previews/${encodeURIComponent(params.previewId)}/consume`,
    { bootstrapJti: params.bootstrapJti },
  );

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const session = parsePreviewSessionPayload(await response.json());

  return session ? { ok: true, session } : { ok: false, status: 502 };
}

export async function revokeRunCoordinatorPreviewSession(params: {
  env: IEnv | undefined;
  previewId: string;
  runId: string;
}): Promise<void> {
  const stub = getCoordinatorStub(params.env, params.runId);

  await postDurableObjectJson(
    stub,
    `https://sandbox-run-coordinator/previews/${encodeURIComponent(params.previewId)}/revoke`,
    {},
  );
}
