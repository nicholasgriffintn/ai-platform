import type { CoreChatOptions } from "~/types";
import { ChatOrchestrator } from "./ChatOrchestrator";

export async function processChatRequest(options: CoreChatOptions) {
  const orchestrator = new ChatOrchestrator(options.env);
  return await orchestrator.process(options);
}
