import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { getChatProvider } from "~/infrastructure/providers/capabilities/chat";
import { resolveExecutableModelForRequest } from "~/modules/chat/application/policy/model-access";
import { resolveSystemModelId } from "~/modules/chat/domain/system-models";
import type { IEnv, IUser, ChatCompletionParameters } from "~/types";

interface HandleCreateFimCompletionsRequest {
  env: IEnv;
  model?: string;
  provider?: string;
  prompt: string;
  suffix?: string;
  max_tokens?: number;
  min_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string[];
  user?: IUser;
}

export const handleCreateFimCompletions = async ({
  env,
  model,
  provider: requestedProvider,
  prompt,
  suffix,
  max_tokens,
  min_tokens,
  temperature,
  top_p,
  stream,
  stop,
  user,
}: HandleCreateFimCompletionsRequest) => {
  const selectedModel = model ?? resolveSystemModelId("fim");
  const { config: modelConfig, credentialAuthority } = await resolveExecutableModelForRequest({
    env,
    user,
    model: selectedModel,
    provider: requestedProvider,
    capability: "supportsFim",
  });

  const provider = getChatProvider(modelConfig.provider, { env, user });
  const context = createServiceContext({ env, user });

  const fimRequest: ChatCompletionParameters = {
    env,
    context,
    credentialAuthority,
    model: modelConfig.matchingModel,
    provider: modelConfig.provider,
    message: prompt,
    prompt,
    suffix,
    fim_mode: true,
    max_tokens,
    min_tokens,
    temperature,
    top_p,
    stream,
    stop,
  };

  const response = await provider.getResponse(fimRequest, user?.id);

  return response;
};
