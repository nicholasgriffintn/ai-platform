import { getPromptText, renderPrompt, tryGetPrompt } from "@ngriffin_uk/polychat-ai-prompts";

export type StrudelStyle = string;
export type StrudelComplexity = string;

export function buildStrudelSystemPrompt(
  style?: StrudelStyle,
  complexity?: StrudelComplexity,
): string {
  return renderPrompt("apps/strudel/system", {
    basePrompt: getPromptText("apps/strudel/base"),
    style,
    styleGuide: style ? tryGetPrompt(`apps/strudel/style/${style}`)?.text : undefined,
    complexity,
    complexityGuide: complexity
      ? tryGetPrompt(`apps/strudel/complexity/${complexity}`)?.text
      : undefined,
  });
}
