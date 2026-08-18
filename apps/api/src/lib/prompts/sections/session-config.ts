import type { ChatMode, Platform, VerbosityLevel } from "~/types";
import { escapeHtml } from "~/utils/html";

import { PromptBuilder } from "../builder";

export interface PromptMemoryPolicy {
  enabled: boolean;
  canRetrieve: boolean;
  canStore: boolean;
}

export const DISABLED_PROMPT_MEMORY_POLICY: PromptMemoryPolicy = {
  enabled: false,
  canRetrieve: false,
  canStore: false,
};

interface SessionConfigOptions {
  mode?: ChatMode;
  platform?: Platform;
  verbosity?: VerbosityLevel;
  preferredLanguage?: string | null;
  memory: PromptMemoryPolicy;
}

function buildMemoryPolicy(memory: PromptMemoryPolicy): string {
  const builder = new PromptBuilder("<memory_policy>")
    .addLine()
    .addLine(`<status>${memory.enabled ? "enabled" : "disabled"}</status>`)
    .addLine(`<retrieval>${memory.canRetrieve ? "enabled" : "disabled"}</retrieval>`)
    .addLine(`<storage>${memory.canStore ? "enabled" : "disabled"}</storage>`);

  if (memory.canStore) {
    builder.addLine(
      "<instruction>Memory storage is enabled by the user's settings. Store only concise, durable context that will help in future conversations; never store credentials, financial identifiers, medical details, or short-lived logistics.</instruction>",
    );
  } else if (memory.canRetrieve) {
    builder.addLine(
      "<instruction>You may retrieve relevant memories, but cannot store new ones. If the user asks you to remember something, explain that memory storage is disabled.</instruction>",
    );
  } else {
    builder.addLine(
      "<instruction>Do not claim to retrieve or store memories. If the user asks you to remember something, explain that memories are disabled for this session.</instruction>",
    );
  }

  return builder.addLine("</memory_policy>").build();
}

export function buildSessionConfigSection({
  mode = "standard",
  platform,
  verbosity = "medium",
  preferredLanguage,
  memory,
}: SessionConfigOptions): string {
  return new PromptBuilder("<session_config>")
    .addLine()
    .addLine(`<mode>${mode}</mode>`)
    .addIf(!!platform, `<origin_platform>${platform}</origin_platform>`)
    .addLine("<verbosity>")
    .addLine(`<selected>${verbosity}</selected>`)
    .addLine("<interpretation>")
    .addLine("<low>Shortest complete answer; minimal explanation and structure.</low>")
    .addLine(
      "<medium>Concise for simple questions; enough explanation for complex work to be understood and acted on.</medium>",
    )
    .addLine(
      "<high>Detailed context, assumptions, examples, edge cases, and trade-offs when relevant.</high>",
    )
    .addLine(
      "<caveman>Ultra-compressed fragments with no filler while preserving accuracy and required substance.</caveman>",
    )
    .addLine("</interpretation>")
    .addLine("</verbosity>")
    .addIf(
      !!preferredLanguage,
      `<preferred_language>${escapeHtml(preferredLanguage ?? "")}</preferred_language>`,
    )
    .add(buildMemoryPolicy(memory))
    .addLine()
    .addLine("</session_config>")
    .addLine()
    .build();
}
