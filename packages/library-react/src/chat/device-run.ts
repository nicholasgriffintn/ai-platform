import { type DesktopBackend, findModelRuntimeEndpoint } from "@ngriffin_uk/polychat-library-chat";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { toRunMessages } from "../lib/run-messages.js";
import { consumeDesktopRun } from "./desktop-run-stream.js";

export interface DeviceModelRunOptions {
  backend: DesktopBackend;
  conversationId: string;
  messages: Message[];
  model: ModelConfigItem;
  onContent: (content: string) => void;
  signal: AbortSignal;
}

export async function streamDeviceModelRun({
  backend,
  conversationId,
  messages,
  model,
  onContent,
  signal,
}: DeviceModelRunOptions): Promise<string> {
  if (model.machineId) {
    throw new Error(
      "This model is advertised by another machine and cannot run through this desktop runtime.",
    );
  }

  const endpoints = await backend.listEndpoints();
  const endpoint = findModelRuntimeEndpoint(endpoints, model.provider, model.runtimeEndpointId);

  if (!endpoint) {
    throw new Error(
      `No ${model.provider ?? "device"} runtime is connected. Add one in desktop settings before using ${model.name ?? model.matchingModel}.`,
    );
  }

  const runMessages = toRunMessages(messages);

  if (runMessages.length === 0) {
    throw new Error("A device run needs at least one message.");
  }

  const run = await backend.startModelRun({
    endpointId: endpoint.id,
    nativeModelId: model.matchingModel,
    conversationId,
    messages: runMessages,
    maxOutputTokens: null,
  });

  return consumeDesktopRun(run, onContent, signal);
}
