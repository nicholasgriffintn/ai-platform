import { getPromptText, renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";

export function drawingDescriptionPrompt(): string {
  return getPromptText("apps/drawing/describe");
}

export function guessDrawingPrompt(usedGuesses: Set<string>): string {
  return renderPrompt("apps/drawing/guess", {
    usedGuesses: Array.from(usedGuesses).join(", "),
  });
}
