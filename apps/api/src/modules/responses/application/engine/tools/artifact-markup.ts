import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";

export const ARTIFACT_MARKUP_TOOL_CORRECTION = getPromptText("apps/agent-loop/artifact-correction");

export const ARTIFACT_MARKUP_FINAL_ANSWER_NOTICE = getPromptText(
  "apps/agent-loop/artifact-final-answer",
);

export function isArtifactMarkupToolName(name: unknown): boolean {
  return typeof name === "string" && /(^|[_<])artifacts?(?:$|[_<])/i.test(name.trim());
}
