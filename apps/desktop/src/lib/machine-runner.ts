import type { DesktopBackend, DesktopRun } from "@ngriffin_uk/polychat-library-chat";
import { waitForSyncEvent } from "@ngriffin_uk/polychat-library-client";
import type { MachineRunClient } from "@ngriffin_uk/polychat-library-client/machine-runs";
import { delay } from "@ngriffin_uk/polychat-library-client/machine-runs";
import type { MachineRunClaim, MachineRunUpdate } from "@ngriffin_uk/polychat-schemas";
import { buildDeviceSyncTopic } from "@ngriffin_uk/polychat-schemas";

const MACHINE_CLAIM_FALLBACK_MS = 30_000;

async function executeClaim(
  backend: Pick<DesktopBackend, "listEndpoints" | "discoverModels" | "startModelRun">,
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
      while (!finished && !controller.signal.aborted) {
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
    const endpoints = (await backend.listEndpoints()).filter(
      (endpoint) => endpoint.kind === "model" && endpoint.vendor === claim.request.vendor,
    );
    let endpointId: string | undefined;

    for (const endpoint of endpoints) {
      controller.signal.throwIfAborted();
      const models = await backend.discoverModels(endpoint.id).catch(() => []);

      if (models.some((model) => model.nativeId === claim.request.nativeModelId)) {
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
      nativeModelId: claim.request.nativeModelId,
      conversationId: claim.request.conversationId,
      messages: claim.request.messages,
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
        do {
          await flush();
        } while (pendingText && !controller.signal.aborted);
      }
    } finally {
      cancel();
      signal.removeEventListener("abort", cancel);
    }
  }
}

export async function runMachineConsumer(options: {
  backend: Pick<DesktopBackend, "listEndpoints" | "discoverModels" | "startModelRun">;
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
