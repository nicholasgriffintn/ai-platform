import { resolveAiGatewayId } from "@ngriffin_uk/polychat-ai-providers";
import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { guessDrawingPrompt } from "./prompts";

const userGuessesCache = new Map<string, Set<string>>();

export async function guessDrawingFromImage(
  context: ServiceContext,
  drawing: Blob,
  projectId?: string | null,
): Promise<{ guess: string }> {
  const user = context.requireUser();
  const arrayBuffer = await drawing.arrayBuffer();

  const userId = `${user.id}:${projectId ?? "personal"}`;
  const userGuesses = userGuessesCache.get(userId) || new Set<string>();

  const guessRequest = await context.env.AI.run(
    "@cf/llava-hf/llava-1.5-7b-hf",
    {
      prompt: guessDrawingPrompt(userGuesses),
      image: [...new Uint8Array(arrayBuffer)],
    },
    {
      gateway: {
        id: resolveAiGatewayId(),
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

  const guess = guessRequest.description.trim();

  userGuesses.add(guess.toLowerCase());
  userGuessesCache.set(userId, userGuesses);

  return { guess };
}
