import { getExecutableModelsForAccount, getModels } from "@ngriffin_uk/polychat-ai-models";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { AgentHarnessEventRecord } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { OpenAIAgentsClient } from "~/infrastructure/providers/agents/OpenAIAgentsClient";
import { resolveProviderApiKey } from "~/infrastructure/providers/credentials";
import { filterModelsForUserAccess, getModelConfig } from "~/modules/models/application/resolve";
import type { IUser } from "~/types";

import {
  agentSessionInput,
  agentSessionTurnRecords,
  type AgentSessionTranscriptEntry,
} from "./agent-session-turn";

const logger = getLogger({ prefix: "agents/openai-agents" });

export async function startOpenAIAgentsTurn(params: {
  context: ServiceContext;
  user: IUser;
  model: string;
  instructions?: string;
  transcript: readonly AgentSessionTranscriptEntry[];
  operationId: string;
}): Promise<AsyncGenerator<AgentHarnessEventRecord>> {
  const client = new OpenAIAgentsClient(
    await resolveProviderApiKey({
      env: params.context.env,
      providerName: "openai",
      envKeyName: "OPENAI_API_KEY",
      userId: params.user.id,
      logger,
    }),
  );

  return agentSessionTurnRecords(
    {
      harnessName: "OpenAI Agents",
      start: async () => {
        const response = await client.createSession({
          agent: {
            model: params.model,
            ...(params.instructions ? { instructions: params.instructions } : {}),
          },
          environment: {
            type: "openai_hosted",
            network: { access: "restricted", allowed_domains: [] },
          },
          input: agentSessionInput(params.transcript),
          metadata: { polychat_operation_id: params.operationId },
          stream: true,
        });

        if (!response.ok || !response.body) {
          throw new AssistantError(
            (await readResponseTextWithinLimit(response, 64 * 1024)) ||
              `OpenAI Agents did not start (${response.status})`,
            ErrorType.PROVIDER_ERROR,
            502,
          );
        }

        return response.body;
      },
      deleteSession: (sessionId) => client.deleteSession(sessionId),
    },
    params.operationId,
  );
}

export async function resolveOpenAIAgentsModel(params: {
  context: ServiceContext;
  user: IUser;
  preferred: string;
}): Promise<string> {
  const preferred = await getModelConfig(
    params.preferred,
    params.context.env,
    "openai",
    params.user.id,
  );

  if (preferred?.provider === "openai") {
    return preferred.matchingModel;
  }

  const visible = await filterModelsForUserAccess(getModels(), params.context.env, params.user.id, {
    shouldUseCache: true,
    includePlatformModels: true,
  });
  const fallback = Object.values(getExecutableModelsForAccount(visible, params.user)).find(
    (model) => model.provider === "openai" && model.kind !== "agent" && model.supportsToolCalls,
  );

  if (!fallback) {
    throw new AssistantError(
      "OpenAI Agents needs an OpenAI model on this account",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return fallback.matchingModel;
}
