import {
  handleCreateEditCompletions,
  type HandleCreateEditCompletionsRequest,
} from "~/lib/chat/edit-completions";
import { resolveSystemModelId } from "~/lib/chat/policy/system-models";

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
      defaultModel: () => resolveSystemModelId("nextEdit"),
      missingMessagesMessage: "Messages are required for next edit completions",
      operation: "next",
      unsupportedMessage: (selectedModel) =>
        `Model ${selectedModel} does not support next edit completions`,
    },
  );
