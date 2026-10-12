import { getExecutableModelsForAccount, getModels } from "@ngriffin_uk/polychat-ai-models";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { AgentHarnessEvent, AgentHarnessEventRecord } from "@ngriffin_uk/polychat-schemas";
import { readServerSentEvents } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import {
  readRecordObjectField,
  readStringField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { OpenAIAgentsClient } from "~/infrastructure/providers/agents/OpenAIAgentsClient";
import { resolveProviderApiKey } from "~/infrastructure/providers/credentials";
import { filterModelsForUserAccess, getModelConfig } from "~/modules/models/application/resolve";
import type { IUser } from "~/types";

const logger = getLogger({ prefix: "agents/openai-agents" });

export interface OpenAIAgentsTranscriptEntry {
  role: "user" | "assistant";
  text: string;
}

function eventFromSession(
  event: Record<string, unknown>,
  operationId: string,
): AgentHarnessEvent | null {
  const type = readStringField(event, "type");
  const turn = readRecordObjectField(event, "turn");
  const isRootTurn = turn.subagent_id === null || turn.subagent_id === undefined;

  if (type === "agent.session.turn.output_text.delta") {
    const delta = readStringField(event, "delta");

    return delta
      ? {
          type: "text-delta",
          partId: readStringField(event, "item_id") ?? operationId,
          delta,
        }
      : null;
  }

  if (type === "agent.session.turn.completed" && isRootTurn) {
    return { type: "operation-settled", operationId, status: "done" };
  }

  if (
    type === "error" ||
    type === "agent.session.failed" ||
    type === "agent.session.environment.failed" ||
    ((type === "agent.session.turn.failed" || type === "agent.session.turn.cancelled") &&
      isRootTurn)
  ) {
    const error = readRecordObjectField(event, "error");
    const turnError = readRecordObjectField(turn, "error");

    return {
      type: "operation-settled",
      operationId,
      status: "unanswered",
      reason:
        readStringField(error, "message") ??
        readStringField(turnError, "message") ??
        `OpenAI Agents reported ${type}`,
    };
  }

  return null;
}

export async function* openAIAgentsTurnRecords(params: {
  context: ServiceContext;
  user: IUser;
  model: string;
  instructions?: string;
  transcript: readonly OpenAIAgentsTranscriptEntry[];
  operationId: string;
}): AsyncGenerator<AgentHarnessEventRecord> {
  const apiKey = await resolveProviderApiKey({
    env: params.context.env,
    providerName: "openai",
    envKeyName: "OPENAI_API_KEY",
    userId: params.user.id,
    logger,
  });
  const client = new OpenAIAgentsClient(apiKey);
  const response = await client.createSession({
    agent: {
      model: params.model,
      ...(params.instructions ? { instructions: params.instructions } : {}),
    },
    environment: { type: "openai_hosted", network: { access: "restricted", allowed_domains: [] } },
    input: params.transcript.map((entry) => ({
      role: entry.role,
      content: [{ type: entry.role === "user" ? "input_text" : "output_text", text: entry.text }],
    })),
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

  const queue: AgentHarnessEvent[] = [];
  let sessionId: string | undefined;
  let finished = false;
  let wake: (() => void) | undefined;
  const reading = readServerSentEvents(response.body, {
    onEvent: (event) => {
      if (readStringField(event, "type") === "agent.session.created") {
        sessionId = readStringField(readRecordObjectField(event, "session"), "id");
      }

      const translated = eventFromSession(event, params.operationId);

      if (translated) {
        queue.push(translated);
        wake?.();
      }
    },
  }).finally(() => {
    finished = true;
    wake?.();
  });
  let seq = 0;

  try {
    for (;;) {
      const event = queue.shift();

      if (event) {
        seq += 1;
        yield { seq, event };

        if (event.type === "operation-settled") {
          return;
        }

        continue;
      }

      if (finished) {
        seq += 1;
        yield {
          seq,
          event: {
            type: "operation-settled",
            operationId: params.operationId,
            status: "unanswered",
            reason: "The OpenAI Agents stream ended early",
          },
        };

        return;
      }

      await new Promise<void>((resolve) => {
        wake = resolve;
      });
      wake = undefined;
    }
  } finally {
    await reading.catch(() => undefined);

    if (sessionId) {
      await client.deleteSession(sessionId).catch((error: unknown) => {
        logger.warn("Failed to delete OpenAI Agents session", { error, session_id: sessionId });
      });
    }
  }
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
