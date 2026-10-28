import type { DesktopBackend, DesktopRun } from "@ngriffin_uk/polychat-library-chat";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { API_BASE_URL } from "@ngriffin_uk/polychat-library-client";
import type { MachineRunClient } from "@ngriffin_uk/polychat-library-client/machine-runs";
import { waitForSyncEvent } from "@ngriffin_uk/polychat-library-client/sync";
import { streamAgentSessionRun } from "@ngriffin_uk/polychat-library-react";
import type {
  AgentApprovalDecision,
  MachineRunClaim,
  MachineRunUpdate,
  ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import {
  buildDeviceSyncTopic,
  MACHINE_MAX_ACTIVE_RUNS,
  MACHINE_MAX_OPEN_RUNS,
} from "@ngriffin_uk/polychat-schemas";
import { delay, sortCopy } from "@ngriffin_uk/polychat-utility-core";

import { createMachineAgentEvents } from "./machine-agent-events";

const MACHINE_CLAIM_FALLBACK_MS = 30_000;
const HEARTBEAT_MS = 10_000;
const EVENT_FLUSH_MS = 1000;
const UPDATE_RETRY_WINDOW_MS = 30_000;
const EVENTS_PER_UPDATE = 200;

type MachineRunnerBackend = Pick<
  DesktopBackend,
  | "listEndpoints"
  | "startModelRun"
  | "discoverModels"
  | "agentSupportsSessions"
  | "startAgentSession"
  | "readAgentThread"
  | "saveAgentThread"
  | "pickAgentDirectory"
  | "saveAgentDirectory"
  | "listAgentDirectories"
  | "ensureWorkDirectory"
  | "probeAgentTool"
  | "runLocalTool"
>;

type Claim = NonNullable<MachineRunClaim>;
type AnswerApproval = (decision: AgentApprovalDecision) => Promise<void>;

function workMcpConfig(token: string | null): string | null {
  return token
    ? JSON.stringify({
        mcpServers: {
          polychat: {
            type: "http",
            url: `${API_BASE_URL}/mcp/work`,
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      })
    : null;
}

async function latestAgentDirectoryId(backend: MachineRunnerBackend): Promise<string | null> {
  const directories = await backend.listAgentDirectories().catch(() => []);

  return (
    sortCopy(directories, (left, right) =>
      (right.lastUsedAt ?? "").localeCompare(left.lastUsedAt ?? ""),
    )[0]?.id ?? null
  );
}

async function executeClaim(
  backend: MachineRunnerBackend,
  client: MachineRunClient,
  machineId: string,
  claim: Claim,
  signal: AbortSignal,
  onWaiting: (waiting: boolean) => void,
) {
  let run: DesktopRun | undefined;
  let sequence = 0;
  let pendingText = "";
  let state: MachineRunUpdate["state"] = "running";
  let error: string | undefined;
  let finished = false;
  let wake: (() => void) | undefined;
  const events = createMachineAgentEvents();
  const answers = new Map<string, AnswerApproval>();
  const controller = new AbortController();
  const cancel = () => {
    controller.abort();
    run?.cancel();
  };

  const nudge = () => wake?.();

  signal.addEventListener("abort", cancel, { once: true });
  let failingSince: number | undefined;
  const send = async () => {
    const text = pendingText.slice(0, 32_000);
    const batch = events.peek(EVENTS_PER_UPDATE);
    const snapshot = await client.update(
      machineId,
      {
        id: claim.request.id,
        token: claim.token,
        sequence,
        text,
        events: batch,
        state:
          pendingText.length > text.length || events.pending > batch.length ? "running" : state,
        error,
      },
      signal,
    );

    pendingText = pendingText.slice(text.length);
    events.drop(batch.length);
    sequence += 1;
    for (const decision of snapshot.decisions) {
      const answer = answers.get(decision.approvalId);

      answers.delete(decision.approvalId);
      void answer?.(decision.approved ? "accept" : "decline").catch(() => undefined);
    }

    if (snapshot.decisions.length > 0 && answers.size === 0) {
      onWaiting(false);
    }

    if (snapshot.state === "cancelled" || snapshot.state === "failed") {
      cancel();
    }
  };

  const flush = async () => {
    try {
      await send();
      failingSince = undefined;
    } catch (cause) {
      failingSince ??= Date.now();

      if (Date.now() - failingSince > UPDATE_RETRY_WINDOW_MS) {
        throw cause;
      }

      await delay(EVENT_FLUSH_MS, controller.signal);
    }
  };

  let flushing: Promise<void> | undefined;

  try {
    signal.throwIfAborted();
    flushing = (async () => {
      for (;;) {
        if (finished || controller.signal.aborted) {
          break;
        }

        await flush();
        await Promise.race([
          delay(events.pending > 0 ? EVENT_FLUSH_MS : HEARTBEAT_MS, controller.signal),
          new Promise<void>((resolve) => {
            wake = resolve;
          }),
        ]);
        await delay(EVENT_FLUSH_MS, controller.signal);
      }
    })().catch((cause) => {
      if (!controller.signal.aborted) {
        error = "The connection to Polychat was lost.";
        cancel();
        throw cause;
      }
    });
    void flushing.catch(() => undefined);
    if ("kind" in claim.request && claim.request.kind === "agent") {
      const request = claim.request;
      const agentModel: ModelConfigItem = {
        kind: "agent",
        matchingModel: request.driver,
        provider: request.driver,
        name: request.driver,
      };

      await streamAgentSessionRun({
        backend,
        conversationId: request.conversationId,
        messages: request.messages.map((message, index): Message => ({
          id: `${request.id}:${index}`,
          ...message,
        })),
        model: agentModel,
        onContent: (content) => {
          events.text(content);
          nudge();
        },
        onReasoning: (delta) => {
          events.reasoning(delta);
          nudge();
        },
        onItem: (item) => {
          events.item(item);
          nudge();
        },
        onUsage: (usage) => events.usage(usage),
        onStatus: () => undefined,
        onApproval: (approval, answer) => {
          answers.set(approval.requestId, answer);
          onWaiting(true);
          events.approval(approval);
          nudge();
        },
        signal: controller.signal,
        permissionMode: request.permissionMode,
        reasoningEffort: request.reasoningEffort,
        selectedModel: request.selectedModel,
        defaultDirectoryId: request.workFolder
          ? (await backend.ensureWorkDirectory(request.workFolder)).id
          : await latestAgentDirectoryId(backend),
        ...(request.workFolder
          ? { isolation: { mcpConfig: workMcpConfig(request.workToken) } }
          : {}),
        sessionContinuation: {
          mode: request.continuationMode === "fresh" ? "fresh" : "resume",
          bindingConversationId: request.bindingConversationId,
          requireBinding: request.continuationMode !== "auto",
        },
      });
      state = "completed";
    } else if ("kind" in claim.request && claim.request.kind === "tool") {
      const result = await backend.runLocalTool({
        directoryId: claim.request.directoryId,
        input: claim.request.input,
      });

      pendingText = JSON.stringify(result);
      state = "completed";
    } else if ("vendor" in claim.request) {
      const modelRequest = claim.request;
      const endpoints = (await backend.listEndpoints()).filter(
        (endpoint) => endpoint.kind === "model" && endpoint.vendor === modelRequest.vendor,
      );
      let endpointId: string | undefined;

      for (const endpoint of endpoints) {
        controller.signal.throwIfAborted();
        const models = await backend.discoverModels(endpoint.id).catch(() => []);

        if (models.some((model) => model.nativeId === modelRequest.nativeModelId)) {
          endpointId = endpoint.id;
          break;
        }
      }

      if (!endpointId) {
        throw new Error("The requested model is no longer installed on this desktop.");
      }

      controller.signal.throwIfAborted();
      run = await backend.startModelRun({
        endpointId,
        nativeModelId: modelRequest.nativeModelId,
        conversationId: modelRequest.conversationId,
        messages: modelRequest.messages,
        maxOutputTokens: null,
      });
      if (controller.signal.aborted) {
        cancel();
      }

      for await (const event of run.events) {
        if (controller.signal.aborted) {
          break;
        }

        if (event.type === "text") {
          pendingText += event.delta;
          if (pendingText.length > 1_000_000) {
            throw new Error("The model exceeded the response limit.");
          }
        }

        if (event.type === "failed") {
          throw new Error(event.message);
        }

        if (event.type === "finished") {
          if (event.reason !== "complete") {
            throw new Error("The model run was cancelled.");
          }

          state = "completed";
        }
      }
    } else {
      throw new Error("The machine run request is unsupported.");
    }

    if (state !== "completed" && !controller.signal.aborted) {
      throw new Error("The runtime disconnected before completing its reply.");
    }
  } catch (cause) {
    state = "failed";
    error = cause instanceof Error ? cause.message.slice(0, 1000) : "The desktop model run failed.";
  } finally {
    finished = true;
    nudge();
    await flushing?.catch(() => undefined);
    try {
      if (!signal.aborted && !controller.signal.aborted) {
        for (;;) {
          await flush();

          if ((!pendingText && events.pending === 0) || controller.signal.aborted) {
            break;
          }
        }
      }
    } finally {
      cancel();
      signal.removeEventListener("abort", cancel);
    }
  }
}

export async function runMachineConsumer(options: {
  backend: MachineRunnerBackend;
  client: MachineRunClient;
  machineId: string;
  signal: AbortSignal;
  onError?: (error: unknown) => void;
}) {
  const { backend, client, machineId, signal, onError } = options;
  const topic = buildDeviceSyncTopic("machine", machineId);
  const active = new Set<Promise<void>>();
  const waiting = new Set<object>();
  let nudgeLoop: (() => void) | undefined;
  const stateChanged = () =>
    new Promise<void>((resolve) => {
      nudgeLoop = resolve;
    });
  const report = (error: unknown) => {
    if (!signal.aborted) {
      onError?.(error);
    }
  };

  while (!signal.aborted) {
    if (
      active.size - waiting.size >= MACHINE_MAX_ACTIVE_RUNS ||
      active.size >= MACHINE_MAX_OPEN_RUNS
    ) {
      await Promise.race([...active, stateChanged()]);
      continue;
    }

    const claim = await client.claim(machineId, signal).catch((error: unknown) => {
      report(error);

      return null;
    });

    if (claim) {
      const token = {};
      const job: Promise<void> = executeClaim(
        backend,
        client,
        machineId,
        claim,
        signal,
        (isWaiting) => {
          if (isWaiting) {
            waiting.add(token);
          } else {
            waiting.delete(token);
          }

          nudgeLoop?.();
        },
      )
        .catch(report)
        .finally(() => {
          waiting.delete(token);
          active.delete(job);
        });

      active.add(job);
      continue;
    }

    await Promise.race([
      waitForSyncEvent(topic, MACHINE_CLAIM_FALLBACK_MS, signal).catch(() => undefined),
      ...active,
    ]);
  }

  await Promise.allSettled(active);
}
