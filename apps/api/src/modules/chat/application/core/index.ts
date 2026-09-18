import { ChatOrchestrator } from "~/modules/chat/application/core/ChatOrchestrator";
import type { CoreChatOptions } from "~/types";

export async function processChatRequest(options: CoreChatOptions) {
  const orchestrator = new ChatOrchestrator(options.env);

  return await orchestrator.process(options);
}
