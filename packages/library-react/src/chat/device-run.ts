import { type DesktopBackend, findModelRuntimeEndpoint } from "@ngriffin_uk/polychat-library-chat";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export interface DeviceModelRunOptions {
  backend: DesktopBackend;
  conversationId: string;
  messages: Message[];
  model: ModelConfigItem;
  onContent: (content: string) => void;
  signal: AbortSignal;
}

function toRunMessages(messages: Message[]) {
  return messages
    .filter(
      (message) =>
        message.role === "system" || message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      role: message.role as "system" | "user" | "assistant",
      content: getMessageTextContent(message),
    }))
    .filter((message) => message.content.length > 0);
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
  const endpoint = findModelRuntimeEndpoint(endpoints, model.provider);

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

  const cancel = () => run.cancel();

  signal.addEventListener("abort", cancel, { once: true });

  let text = "";

  try {
    for await (const event of run.events) {
      if (event.type === "text") {
        text += event.delta;
        onContent(text);

        continue;
      }

      if (event.type === "failed") {
        throw new Error(event.message);
      }

      if (event.type === "finished" && event.reason === "cancelled") {
        throw new Error("The device run was cancelled.");
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
  }

  return text;
}
