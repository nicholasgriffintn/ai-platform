import { gatewayId } from "../../../constants/app";
import { guessDrawingPrompt } from "../../../lib/prompts";
import type { IEnv, IFunctionResponse, IUser } from "../../../types";
import { AssistantError, ErrorType } from "../../../utils/errors";

export type ImageFromDrawingRequest = {
  env: IEnv;
  request: {
    drawing?: Blob;
  };
  user: IUser;
};

interface ImageFromDrawingResponse extends IFunctionResponse {
  completion_id?: string;
}

const usedGuesses = new Set<string>();

export const guessDrawingFromImage = async (
  req: ImageFromDrawingRequest,
): Promise<ImageFromDrawingResponse> => {
  const { env, request, user } = req;

  if (!request.drawing) {
    throw new AssistantError("Missing drawing", ErrorType.PARAMS_ERROR);
  }

  const arrayBuffer = await request.drawing.arrayBuffer();

  const guessRequest = await env.AI.run(
    "@cf/llava-hf/llava-1.5-7b-hf",
    {
      prompt: guessDrawingPrompt(usedGuesses),
      image: [...new Uint8Array(arrayBuffer)],
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

  if (!guessRequest.description) {
    throw new AssistantError("Failed to generate description");
  }

  usedGuesses.add(guessRequest.description.trim().toLowerCase());

  return {
    content: guessRequest.description,
  };
};
