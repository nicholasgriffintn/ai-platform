import {
  handleCreateEditCompletions,
  type HandleCreateEditCompletionsRequest,
} from "~/modules/code/application/edit-completions";

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
      role: "applyEdit",
      missingMessagesMessage: "Messages are required for apply edit completions",
      operation: "apply",
      unsupportedMessage: (selectedModel) =>
        `Model ${selectedModel} does not support apply edit completions`,
    },
  );
