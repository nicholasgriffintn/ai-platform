import { APP_NAME } from "~/constants/app";
import { PromptBuilder } from "../builder";

interface AssistantPrinciplesOptions {
  isAgent: boolean;
  supportsToolCalls?: boolean;
  supportsArtifacts?: boolean;
  supportsReasoning?: boolean;
  responseMode?: string;
  preferredLanguage?: string | null;
  format?: "full" | "compact";
}

export function buildAssistantPrinciplesSection({
  isAgent,
  supportsToolCalls,
  supportsArtifacts,
  supportsReasoning,
  responseMode,
  preferredLanguage,
  format = "full",
}: AssistantPrinciplesOptions): string {
  const builder = new PromptBuilder("<assistant_principles>").addLine();
  const addPrinciple = (text: string) =>
    builder.addLine(`<principle>${text}</principle>`);

  if (format === "compact") {
    addPrinciple(
      "Focus on the user's goal and clarify only the essentials before responding.",
    );
    addPrinciple(
      "Think through your approach, but share only the reasoning that makes the answer easier to follow.",
    );
    addPrinciple(
      `Keep a respectful, practical tone aligned with ${APP_NAME}'s safety expectations.`,
    );
  } else {
    addPrinciple(
      "Start by understanding the user's core intent and ask clarifying questions whenever requirements are ambiguous.",
    );
    addPrinciple(
      "Reason deliberately before you answer. Break complex problems into steps, validate intermediate results, and only surface your final answer once confident.",
    );
    addPrinciple(
      "Ground claims in the provided context, retrieval results, or cited sources. Flag uncertainty when information is missing or conflicting.",
    );
    addPrinciple(
      `Maintain a direct, respectful tone that aligns with the user's preferences and ${APP_NAME}'s safety expectations.`,
    );
    addPrinciple(
      "Proactively suggest useful next steps or related insights when they meaningfully help the user.",
    );
  }

  const modeSpecificPrinciple = (() => {
    switch (responseMode) {
      case "concise":
        return format === "compact"
          ? "Keep answers tight but complete; avoid restating obvious context."
          : "Favor brevity: deliver the essential answer in as few words as clarity allows while remaining complete.";
      case "formal":
        return format === "compact"
          ? "Use precise, formal language and structured explanations."
          : "Maintain a formal, professional register and reference precise terminology when available.";
      case "explanatory":
        return format === "compact"
          ? "Lay out your reasoning clearly so the user can follow each major step."
          : "Expand on your reasoning with structured explanations so the user can follow each major step.";
      default:
        return format === "compact"
          ? "Match the user's tone while keeping the structure clear and purposeful."
          : "Match the user's tone while staying clear and structured; adapt verbosity to the task's complexity.";
    }
  })();

  addPrinciple(modeSpecificPrinciple);

  if (supportsToolCalls || isAgent) {
    addPrinciple(
      format === "compact"
        ? "Call tools only when they add value, and summarise their results before moving on."
        : "Use tools thoughtfully: explain why a tool is needed, summarise tool outputs, and stop tool usage as soon as you have what you need.",
    );
  }

  if (supportsArtifacts) {
    addPrinciple(
      format === "compact"
        ? "Use artifacts for sizeable or reusable work and describe them briefly in your reply."
        : "Leverage artifacts for substantial code, long-form writing, or media so the user can inspect and reuse your work easily.",
    );
  }

  if (!supportsReasoning) {
    addPrinciple(
      format === "compact"
        ? "Without native reasoning traces, share a short scratchpad for complex tasks."
        : "Since native reasoning traces are unavailable, explicitly share a concise scratchpad of your thinking for complex tasks.",
    );
  }

  const sanitizedLanguage = preferredLanguage?.trim();
  if (sanitizedLanguage) {
    addPrinciple(
      format === "compact"
        ? `Default to replying in ${sanitizedLanguage} unless the user changes languages.`
        : `Default to replying in ${sanitizedLanguage} unless the user explicitly switches languages.`,
    );
  }

  builder.addLine("</assistant_principles>").addLine();

  return builder.build();
}
