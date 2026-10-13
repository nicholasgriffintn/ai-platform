import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import type { AgentHarnessEventRecord, RemoteAgentHarnessId } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChatCompletionParameters, IUser } from "~/types";

import type { AgentSessionTranscriptEntry } from "./agent-session-turn";
import {
  resolveBedrockManagedAgentModel,
  startBedrockManagedAgentsTurn,
} from "./bedrock-managed-agents-turn";
import { resolveOpenAIAgentsModel, startOpenAIAgentsTurn } from "./openai-agents-turn";

const TRANSCRIPT_LIMIT = 20;

function agentSessionTranscript(
  messages: ChatCompletionParameters["messages"],
): AgentSessionTranscriptEntry[] {
  return (messages ?? [])
    .flatMap((message): AgentSessionTranscriptEntry[] => {
      if (message.role !== "user" && message.role !== "assistant") {
        return [];
      }

      const text = extractTextFromMessageContent(message.content).trim();

      return text ? [{ role: message.role, text }] : [];
    })
    .slice(-TRANSCRIPT_LIMIT);
}

export async function startRemoteHarnessTurn(params: {
  harness: RemoteAgentHarnessId;
  context: ServiceContext;
  user: IUser;
  preferredModel: string;
  messages: ChatCompletionParameters["messages"];
  instructions?: string;
  projectId?: string;
}): Promise<AsyncGenerator<AgentHarnessEventRecord>> {
  const turn = {
    context: params.context,
    transcript: agentSessionTranscript(params.messages),
    operationId: generateId(),
    ...(params.instructions ? { instructions: params.instructions } : {}),
  };
  const preference = {
    context: params.context,
    user: params.user,
    preferred: params.preferredModel,
  };

  if (params.harness === "bedrock-managed-agents") {
    return startBedrockManagedAgentsTurn({
      ...turn,
      model: await resolveBedrockManagedAgentModel(preference),
      ...(params.projectId ? { projectId: params.projectId } : {}),
    });
  }

  return startOpenAIAgentsTurn({
    ...turn,
    user: params.user,
    model: await resolveOpenAIAgentsModel(preference),
  });
}
