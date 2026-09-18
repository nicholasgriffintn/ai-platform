import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { getChatProvider } from "~/infrastructure/providers/capabilities/chat";
import { toProviderMessages } from "~/modules/chat/application/messages/provider-mapping";
import { resolveExecutableModelForRequest } from "~/modules/chat/application/policy/model-access";
import type { ChatCompletionParameters, ChatRole, IEnv, IUser, Message } from "~/types";

export interface HandleCreateEditCompletionsRequest {
  env: IEnv;
  model?: string;
  provider?: string;
  messages: Array<{ role: string; content?: any; [key: string]: any }>;
  stream?: boolean;
  user?: IUser;
}

type EditOperation = "next" | "apply";
type EditCapability = "supportsNextEdit" | "supportsApplyEdit";

interface CreateEditCompletionsOptions {
  capability: EditCapability;
  defaultModel: () => string;
  missingMessagesMessage: string;
  operation: EditOperation;
  unsupportedMessage: (model: string) => string;
}

function normalizeCompletionMessages(
  messages: HandleCreateEditCompletionsRequest["messages"],
): Message[] {
  return toProviderMessages(
    messages.map((message) => ({
      role: message.role as ChatRole,
      content: message.content ?? "",
      name: message.name,
      tool_calls: message.tool_calls,
      parts: message.parts,
      status: message.status,
      data: message.data,
      model: message.model,
      log_id: message.log_id,
      citations: message.citations,
      app: message.app,
      id: message.id,
      timestamp: message.timestamp,
      platform: message.platform,
    })),
  );
}

export async function handleCreateEditCompletions(
  {
    env,
    model,
    provider: requestedProvider,
    messages,
    stream,
    user,
  }: HandleCreateEditCompletionsRequest,
  options: CreateEditCompletionsOptions,
) {
  if (!messages?.length) {
    throw new AssistantError(options.missingMessagesMessage, ErrorType.PARAMS_ERROR);
  }

  const selectedModel = model ?? options.defaultModel();
  const { config: modelConfig, credentialAuthority } = await resolveExecutableModelForRequest({
    env,
    user,
    model: selectedModel,
    provider: requestedProvider,
    capability: options.capability,
  });

  const provider = getChatProvider(modelConfig.provider, { env, user });
  const context = createServiceContext({ env, user });

  const editRequest: ChatCompletionParameters = {
    env,
    context,
    credentialAuthority,
    model: modelConfig.matchingModel,
    provider: modelConfig.provider,
    messages: normalizeCompletionMessages(messages),
    stream,
    edit_operation: options.operation,
  };

  return await provider.getResponse(editRequest, user?.id);
}
