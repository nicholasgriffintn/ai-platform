import { ChatOrchestrator } from "~/services/chat/core/ChatOrchestrator";
import type { CoreChatOptions } from "~/types";

export async function processChatRequest(options: CoreChatOptions) {
  const orchestrator = new ChatOrchestrator(options.env);

  return await orchestrator.process(options);
}
