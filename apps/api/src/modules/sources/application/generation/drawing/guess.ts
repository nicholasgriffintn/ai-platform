import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { describePicture } from "~/modules/generate/application/vision";

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

  const guess = await describePicture(context, {
    prompt: guessDrawingPrompt(userGuesses),
    image: arrayBuffer,
    mimeType: drawing.type || "image/png",
  });

  if (!guess) {
    throw new AssistantError("Failed to generate description");
  }

  userGuesses.add(guess.toLowerCase());
  userGuessesCache.set(userId, userGuesses);

  return { guess };
}
