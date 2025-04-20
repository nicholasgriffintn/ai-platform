import { gatewayId } from "~/constants/app";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type TranscribeRequest = {
  env: IEnv;
  audio: Blob;
  user: IUser;
};

export const handleTranscribe = async (
  req: TranscribeRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { audio, env, user } = req;

  if (!env.AI) {
    throw new AssistantError("Missing AI binding", ErrorType.PARAMS_ERROR);
  }

  if (!audio) {
    throw new AssistantError("Missing audio", ErrorType.PARAMS_ERROR);
  }

  const arrayBuffer = await audio.arrayBuffer();

  const response = await env.AI.run(
    "@cf/openai/whisper",
    {
      audio: [...new Uint8Array(arrayBuffer)],
    },
    {
      gateway: {
        id: gatewayId,
        skipCache: false,
        cacheTtl: 3360,
        metadata: {
          email: user?.email,
        },
      },
    },
  );

  if (!response.text) {
    throw new AssistantError("No response from the model");
  }

  return {
    status: "success",
    content: response.text,
    data: response,
  };
};
