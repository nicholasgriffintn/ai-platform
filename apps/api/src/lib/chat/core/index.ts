import type { ChatCompletionParameters } from "~/types";
import { ChatOrchestrator } from "./ChatOrchestrator";

export type CoreChatOptions = ChatCompletionParameters & {
  use_multi_model?: boolean;
  anonymousUser?: any;
  current_step?: number;
  max_steps?: number;
};

export async function processChatRequest(options: CoreChatOptions) {
  const orchestrator = new ChatOrchestrator(options.env);
  return await orchestrator.process(options);
}
