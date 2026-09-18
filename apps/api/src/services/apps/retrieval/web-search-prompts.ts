import { getPromptText, renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";

export function webSearchSimilarQuestionsSystemPrompt(): string {
  return getPromptText("apps/web-search/questions");
}

export function webSearchAnswerSystemPrompt(contexts: string): string {
  return renderPrompt("apps/web-search/answer", { contexts });
}
