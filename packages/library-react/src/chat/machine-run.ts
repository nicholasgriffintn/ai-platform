import { machineRunClient, delay } from "@ngriffin_uk/polychat-library-client";
import { modelRuntimeVendorSchema } from "@ngriffin_uk/polychat-schemas";

import { toRunMessages } from "../lib/run-messages.js";
import type { DeviceModelRunOptions } from "./device-run.js";

export async function streamMachineModelRun({
  conversationId,
  messages,
  model,
  onContent,
  signal,
}: Omit<DeviceModelRunOptions, "backend">): Promise<string> {
  if (!model.machineId) {
    throw new Error("Choose a connected machine before sending.");
  }

  const id = crypto.randomUUID();
  const machineId = model.machineId;
  let terminal = false;

  try {
    let snapshot = await machineRunClient.start(
      machineId,
      {
        id,
        conversationId,
        vendor: modelRuntimeVendorSchema.parse(model.provider),
        nativeModelId: model.matchingModel,
        messages: toRunMessages(messages),
      },
      signal,
    );

    while (true) {
      signal.throwIfAborted();
      onContent(snapshot.text);
      if (snapshot.state === "completed") {
        terminal = true;

        return snapshot.text;
      }

      if (snapshot.state === "failed" || snapshot.state === "cancelled") {
        terminal = true;
        throw new Error(snapshot.error ?? "The machine run was cancelled.");
      }

      await delay(2000, signal);
      snapshot = await machineRunClient.read(machineId, id, signal);
    }
  } finally {
    if (!terminal) {
      await machineRunClient.cancel(machineId, id).catch(() => undefined);
    }
  }
}
