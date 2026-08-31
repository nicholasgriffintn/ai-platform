import type { ExecutionContext } from "@cloudflare/workers-types";
import type { ParsedChatCompletionRequestBody } from "@ngriffin_uk/polychat-schemas";

import { formatToolCalls } from "~/lib/chat/tools/provider-tool-definitions";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { findModelConfig } from "~/lib/providers/models";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { requireAgentAccess } from "./access";
import { prepareAgentCompletionRequest } from "./completion-request";
import { buildAgentCompletionTools, buildAgentPersona } from "./completion-tools";

export async function createAgentCompletion({
  env,
  context,
  body,
  agentId,
  user,
  anonymousUser,
  executionCtx,
  signal,
}: {
  env: IEnv;
  context?: ServiceContext;
  body: ParsedChatCompletionRequestBody;
  agentId: string;
  user: IUser | undefined;
  anonymousUser: any;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
}) {
  const serviceContext =
    context ??
    createServiceContext({
      env,
      user,
    });

  serviceContext.ensureDatabase();

  const agent = await requireAgentAccess(serviceContext, agentId, "read", user?.id);

  const functionSchemas = await buildAgentCompletionTools(agent, serviceContext);

  const modelToUse = agent.model || body.model;
  const modelDetails = await findModelConfig(modelToUse || "", env, body.provider);

  if (!modelDetails) {
    throw new AssistantError("Invalid model", ErrorType.PARAMS_ERROR);
  }

  const formattedTools = formatToolCalls(modelDetails.provider, functionSchemas);

  const requestParams = prepareAgentCompletionRequest({
    agent,
    body,
    modelProvider: modelDetails.provider,
    formattedTools,
    persona: buildAgentPersona(agent),
  });

  const response = await handleCreateChatCompletions({
    env: serviceContext.env,
    request: requestParams,
    user,
    anonymousUser,
    context: serviceContext,
    executionCtx,
    signal,
  });

  return response;
}
