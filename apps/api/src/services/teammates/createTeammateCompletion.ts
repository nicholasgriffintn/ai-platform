import type { ExecutionContext } from "@cloudflare/workers-types";
import type {
  ChatRunTrigger,
  ConversationType,
  ParsedChatCompletionRequestBody,
} from "@ngriffin_uk/polychat-schemas";

import { formatToolCalls } from "~/lib/chat/tools/provider-tool-definitions";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { findModelConfig, getDefaultChatModel } from "~/lib/providers/models";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { CoreChatOptions, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { requireTeammateAccess } from "./access";
import { prepareTeammateCompletionRequest } from "./completion-request";
import { buildTeammateCompletionTools, buildTeammatePersona } from "./completion-tools";

export async function createTeammateCompletion({
  env,
  context,
  body,
  teammateId,
  user,
  anonymousUser,
  executionCtx,
  signal,
  conversationType,
  trigger,
  maxStepsOverride,
  durableExecution,
}: {
  env: IEnv;
  context?: ServiceContext;
  body: ParsedChatCompletionRequestBody;
  teammateId: string;
  user: IUser | undefined;
  anonymousUser: any;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
  conversationType?: ConversationType;
  trigger?: ChatRunTrigger;
  maxStepsOverride?: number;
  durableExecution?: CoreChatOptions["durable_execution"];
}) {
  const serviceContext =
    context ??
    createServiceContext({
      env,
      user,
    });

  serviceContext.ensureDatabase();

  const teammate = await requireTeammateAccess(serviceContext, teammateId, "read", user?.id);

  const functionSchemas = await buildTeammateCompletionTools(teammate, serviceContext);

  const requestedModel = teammate.model || body.model || undefined;
  const fallbackModel = requestedModel
    ? undefined
    : await getDefaultChatModel(serviceContext.env, user);
  const modelToUse = requestedModel ?? fallbackModel?.model;
  const modelDetails = await findModelConfig(
    modelToUse || "",
    env,
    body.provider ?? fallbackModel?.provider,
    user?.id,
  );

  if (!modelDetails) {
    throw new AssistantError("Invalid model", ErrorType.PARAMS_ERROR);
  }

  const formattedTools = formatToolCalls(modelDetails.provider, functionSchemas);

  const requestParams = prepareTeammateCompletionRequest({
    teammate,
    body,
    modelProvider: modelDetails.provider,
    formattedTools,
    persona: buildTeammatePersona(teammate),
    maxStepsOverride,
  });

  const response = await handleCreateChatCompletions({
    env: serviceContext.env,
    request: {
      ...requestParams,
      ...(conversationType ? { conversation_type: conversationType } : {}),
      ...(trigger ? { trigger } : {}),
      ...(durableExecution ? { durable_execution: durableExecution } : {}),
    },
    user,
    anonymousUser,
    context: serviceContext,
    executionCtx,
    signal,
  });

  return response;
}
