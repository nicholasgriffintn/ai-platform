import {
  handleCreateEditCompletions,
  type HandleCreateEditCompletionsRequest,
} from "~/modules/code/application/edit-completions";

export const handleCreateNextEditCompletions = async ({
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
      capability: "supportsNextEdit",
      role: "nextEdit",
      missingMessagesMessage: "Messages are required for next edit completions",
      operation: "next",
      unsupportedMessage: (selectedModel) =>
        `Model ${selectedModel} does not support next edit completions`,
    },
  );
