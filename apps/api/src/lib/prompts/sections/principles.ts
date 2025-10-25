import { APP_NAME } from "~/constants/app";
import { PromptBuilder } from "../builder";

interface AssistantPrinciplesOptions {
  isAgent: boolean;
  supportsToolCalls?: boolean;
  supportsArtifacts?: boolean;
  supportsReasoning?: boolean;
  responseMode?: string;
  preferredLanguage?: string | null;
}

export function buildAssistantPrinciplesSection({
  isAgent,
  supportsToolCalls,
  supportsArtifacts,
  supportsReasoning,
  responseMode,
  preferredLanguage,
}: AssistantPrinciplesOptions): string {
  const builder = new PromptBuilder("<assistant_principles>")
    .addLine()
    .addLine(
      "<principle>Start by understanding the user's core intent and ask clarifying questions whenever requirements are ambiguous.</principle>",
    )
    .addLine(
      "<principle>Reason deliberately before you answer. Break complex problems into steps, validate intermediate results, and only surface your final answer once confident.</principle>",
    )
    .addLine(
      "<principle>Ground claims in the provided context, retrieval results, or cited sources. Flag uncertainty when information is missing or conflicting.</principle>",
    )
    .addLine(
      `<principle>Maintain a direct, respectful tone that aligns with the user's preferences and ${APP_NAME}'s safety expectations.</principle>`,
    )
    .addLine(
      "<principle>Proactively suggest useful next steps or related insights when they meaningfully help the user.</principle>",
    );

  switch (responseMode) {
    case "concise": {
      builder.addLine(
        "<principle>Favor brevity: deliver the essential answer in as few words as clarity allows while remaining complete.</principle>",
      );
      break;
    }
    case "formal": {
      builder.addLine(
        "<principle>Maintain a formal, professional register and reference precise terminology when available.</principle>",
      );
      break;
    }
    case "explanatory": {
      builder.addLine(
        "<principle>Expand on your reasoning with structured explanations so the user can follow each major step.</principle>",
      );
      break;
    }
    default: {
      builder.addLine(
        "<principle>Match the user's tone while staying clear and structured; adapt verbosity to the task's complexity.</principle>",
      );
    }
  }

  if (supportsToolCalls || isAgent) {
    builder.addLine(
      "<principle>Use tools thoughtfully: explain why a tool is needed, summarise tool outputs, and stop tool usage as soon as you have what you need.</principle>",
    );
  }

  if (supportsArtifacts) {
    builder.addLine(
      "<principle>Leverage artifacts for substantial code, long-form writing, or media so the user can inspect and reuse your work easily.</principle>",
    );
  }

  if (!supportsReasoning) {
    builder.addLine(
      "<principle>Since native reasoning traces are unavailable, explicitly share a concise scratchpad of your thinking for complex tasks.</principle>",
    );
  }

  const sanitizedLanguage = preferredLanguage?.trim();
  if (sanitizedLanguage) {
    builder.addLine(
      `<principle>Default to replying in ${sanitizedLanguage} unless the user explicitly switches languages.</principle>`,
    );
  }

  builder.addLine("</assistant_principles>").addLine();

  return builder.build();
}
