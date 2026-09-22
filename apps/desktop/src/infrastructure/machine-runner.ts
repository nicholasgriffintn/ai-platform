import type { DesktopBackend, DesktopRun } from "@ngriffin_uk/polychat-library-chat";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type { MachineRunClient } from "@ngriffin_uk/polychat-library-client/machine-runs";
import { waitForSyncEvent } from "@ngriffin_uk/polychat-library-client/sync";
import { streamAgentSessionRun } from "@ngriffin_uk/polychat-library-react";
import type {
  MachineRunClaim,
  MachineRunUpdate,
  ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import { buildDeviceSyncTopic } from "@ngriffin_uk/polychat-schemas";
import { delay } from "@ngriffin_uk/polychat-utility-core";

import type { LocalBrowserBackend } from "./local-browser";
import type { LocalSandboxBackend } from "./local-sandbox";

const MACHINE_CLAIM_FALLBACK_MS = 30_000;

type MachineRunnerBackend = Pick<
  DesktopBackend & LocalSandboxBackend & LocalBrowserBackend,
  | "listEndpoints"
  | "startModelRun"
  | "discoverModels"
  | "agentSupportsSessions"
  | "startAgentSession"
  | "readAgentThread"
  | "saveAgentThread"
  | "pickAgentDirectory"
  | "saveAgentDirectory"
  | "probeAgentTool"
  | "startLocalSandbox"
  | "requestLocalSandbox"
  | "stopLocalSandbox"
  | "startLocalBrowser"
  | "localBrowserAction"
  | "observeLocalBrowser"
  | "revokeLocalBrowser"
  | "stopLocalBrowser"
>;

async function executeClaim(
  backend: MachineRunnerBackend,
  client: MachineRunClient,
  machineId: string,
  claim: NonNullable<MachineRunClaim>,
  signal: AbortSignal,
) {
  let run: DesktopRun | undefined;
  let sequence = 0;
  let pendingText = "";
  let state: MachineRunUpdate["state"] = "running";
  let error: string | undefined;
  let finished = false;
  const controller = new AbortController();
  const cancel = () => {
    controller.abort();
    run?.cancel();
  };

  signal.addEventListener("abort", cancel, { once: true });
  const flush = async () => {
    const text = pendingText.slice(0, 32_000);

    pendingText = pendingText.slice(text.length);
    const snapshot = await client.update(
      machineId,
      {
        id: claim.request.id,
        token: claim.token,
        sequence,
        text,
        state: pendingText ? "running" : state,
        error,
      },
      signal,
    );

    sequence += 1;
    if (snapshot.state === "cancelled" || snapshot.state === "failed") {
      cancel();
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
        await delay(2000, controller.signal);
      }
    })().catch((cause) => {
      if (!controller.signal.aborted) {
        error = "The connection to Polychat was lost.";
        cancel();
        throw cause;
      }
    });
    void flushing.catch(() => undefined);
    if ("kind" in claim.request && claim.request.kind === "computer") {
      const { operation, resourceId, fence } = claim.request;
      const result =
        operation.type === "start"
          ? { handle: await backend.startLocalBrowser(resourceId) }
          : operation.type === "stop"
            ? await backend.stopLocalBrowser(resourceId, fence).then(() => ({}))
            : operation.type === "revoke"
              ? await backend.revokeLocalBrowser(resourceId, fence).then(() => ({}))
              : operation.type === "observe"
                ? await backend.observeLocalBrowser(resourceId, fence)
                : await backend.localBrowserAction(resourceId, fence, operation.input);

      pendingText = JSON.stringify(result);
      if (pendingText.length > 1_000_000) {
        throw new Error("The browser observation exceeded the machine relay limit.");
      }

      state = "completed";
    } else if ("kind" in claim.request && claim.request.kind === "sandbox") {
      const operation = claim.request.operation;
      const result =
        operation.type === "start"
          ? { containerId: await backend.startLocalSandbox() }
          : operation.type === "stop"
            ? await backend.stopLocalSandbox(operation.containerId).then(() => ({}))
            : await backend.requestLocalSandbox({
                id: operation.containerId,
                path: operation.path,
                method: operation.method,
                body: operation.body,
                contentType: operation.contentType,
              });

      pendingText = JSON.stringify(result);
      if (pendingText.length > 1_000_000) {
        throw new Error("The sandbox response exceeded the machine relay limit.");
      }

      state = "completed";
    } else if ("kind" in claim.request && claim.request.kind === "agent") {
      const agentModel: ModelConfigItem = {
        kind: "agent",
        matchingModel: claim.request.driver,
        provider: claim.request.driver,
        name: claim.request.driver,
      };
      let emittedLength = 0;

      await streamAgentSessionRun({
        backend,
        conversationId: claim.request.conversationId,
        messages: claim.request.messages.map((message, index): Message => ({
          id: `${claim.request.id}:${index}`,
          ...message,
        })),
        model: agentModel,
        onContent: (content) => {
          pendingText += content.slice(emittedLength);
          emittedLength = content.length;
        },
        onStatus: () => undefined,
        onApproval: (_approval, answer) => {
          void answer("decline");
        },
        signal: controller.signal,
        permissionMode: claim.request.permissionMode,
        reasoningEffort: claim.request.reasoningEffort,
        selectedModel: claim.request.selectedModel,
        sessionContinuation: {
          mode: claim.request.continuationMode,
          bindingConversationId: claim.request.bindingConversationId,
          requireBinding: true,
        },
      });
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
    await flushing?.catch(() => undefined);
    try {
      if (!signal.aborted && !controller.signal.aborted) {
        for (;;) {
          await flush();

          if (!pendingText || controller.signal.aborted) {
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

  while (!signal.aborted) {
    let claimed = false;

    try {
      const claim = await client.claim(machineId, signal);

      if (claim) {
        claimed = true;
        await executeClaim(backend, client, machineId, claim, signal);
      }
    } catch (error) {
      if (!signal.aborted) {
        onError?.(error);
      }
    }

    if (claimed || signal.aborted) {
      continue;
    }

    await waitForSyncEvent(topic, MACHINE_CLAIM_FALLBACK_MS, signal).catch(() => undefined);
  }
}
