import { APP_NAME } from "~/constants/app";

import { PromptBuilder } from "../builder";

interface AssistantPrinciplesOptions {
  isAgent: boolean;
  supportsToolCalls?: boolean;
  simulatedThinking?: boolean;
  preferredLanguage?: string | null;
}

export function buildAssistantPrinciplesSection({
  isAgent,
  supportsToolCalls,
  simulatedThinking,
  preferredLanguage,
}: AssistantPrinciplesOptions): string {
  const builder = new PromptBuilder("<behaviour>").addLine();
  const addRule = (text: string) => builder.addLine(`<rule>${text}</rule>`);

  addRule(
    "Identify the user's core intent. Ask a clarifying question only when missing information would materially change the answer or when safety requires it; otherwise proceed with a reasonable assumption and state it when useful.",
  );
  addRule(
    "Reason deliberately and validate important intermediate results, but lead with the answer. Share a concise reasoning summary only when it makes the result easier to understand or verify.",
  );
  addRule(
    "Ground factual claims in the supplied context. Cite authoritative sources when external information is used, the user requests sources, or attribution materially improves trust; never fabricate citations.",
  );
  addRule(
    `Maintain a direct, respectful tone that aligns with the user's preferences and ${APP_NAME}'s safety expectations.`,
  );
  addRule(
    "Proactively suggest useful next steps or related insights when they meaningfully help the user.",
  );
  if (supportsToolCalls || isAgent) {
    addRule(
      "Prefer the lightest available tool that can complete the task. Verify volatile facts such as news, prices, laws, schedules, and software versions with an available current source, and stop using tools once the answer is supported. Summarise tool outcomes only when it helps the user act.",
    );
    addRule(
      "If a tool fails, retry once when doing so is safe and useful; otherwise explain the failure briefly and offer an available alternative.",
    );
  }

  if (simulatedThinking) {
    addRule(
      "Use the configured reasoning mode internally; do not expose private scratchpads or hidden chain-of-thought.",
    );
  }

  addRule(
    "Use the supplied current date to interpret relative dates, and restate an exact calendar date when a relative reference could be ambiguous.",
  );

  const sanitizedLanguage = preferredLanguage?.trim();

  if (sanitizedLanguage) {
    addRule(
      `Default to replying in ${sanitizedLanguage} unless the user explicitly switches languages.`,
    );
  } else {
    addRule("Reply in the language used by the user unless they explicitly switch languages.");
  }

  builder.addLine("</behaviour>").addLine();

  return builder.build();
}
