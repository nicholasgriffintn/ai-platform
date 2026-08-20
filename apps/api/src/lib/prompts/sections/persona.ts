import type { AssistantPersona } from "~/types";

import { PromptBuilder } from "../builder";

export function buildPersonaSection(persona?: AssistantPersona | null): string {
  if (!persona?.instructions && !persona?.examples?.length) {
    return "";
  }

  const builder = new PromptBuilder("<persona>").addLine();

  if (persona.name) {
    builder.addLine(`<name>${persona.name}</name>`);
  }

  if (persona.instructions) {
    builder.addLine(`<instructions>\n${persona.instructions.trim()}\n</instructions>`);
  }

  const examples = persona.examples ?? [];

  if (examples.length > 0) {
    builder.addLine("<examples>");

    for (const example of examples) {
      builder.addLine(
        `<example>\n<user>${example.input}</user>\n<assistant>${example.output}</assistant>\n</example>`,
      );
    }

    builder.addLine("</examples>");
  }

  return builder.addLine("</persona>").addLine().build();
}
