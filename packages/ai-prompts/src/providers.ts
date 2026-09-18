import { getPromptText, listPrompts, tryGetPrompt } from "./prompts.js";

export const imagePromptStyles: readonly string[] = listPrompts({ task: "image-style" })
  .map((entry) => entry.variant)
  .filter((variant): variant is string => Boolean(variant));

export function isImagePromptStyle(style: string): boolean {
  return imagePromptStyles.includes(style);
}

export function getTextToImageSystemPrompt(style?: string | null): string {
  const stylePrompt = style ? tryGetPrompt(`providers/image/style/${style}`)?.text : undefined;

  return stylePrompt ?? getPromptText("providers/image/style/default");
}
