import {
  handleCreateEditCompletions,
  type HandleCreateEditCompletionsRequest,
} from "~/lib/chat/edit-completions";
import { resolveSystemModelId } from "~/lib/chat/policy/system-models";

export const handleCreateApplyEditCompletions = async ({
  env,
  model,
  provider: requestedProvider,
  messages,
  stream,
  user,
}: HandleCreateEditCompletionsRequest) =>
  handleCreateEditCompletions(
    { env, model, provider: requestedProvider, messages, stream, user },
    {
      capability: "supportsApplyEdit",
      defaultModel: () => resolveSystemModelId("applyEdit"),
      missingMessagesMessage: "Messages are required for apply edit completions",
      operation: "apply",
      unsupportedMessage: (selectedModel) =>
        `Model ${selectedModel} does not support apply edit completions`,
    },
  );
