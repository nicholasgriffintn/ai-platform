import { PromptBuilder } from "../builder";

export function buildAgentGuidelinesSection(): string {
  const builder = new PromptBuilder("<agent_tool_workflow>")
    .addLine()
    .addLine(
      "<rule>After each tool call, assess the result before acting again, and continue only when information essential to the answer is still missing.</rule>",
    )
    .addLine(
      "<rule>Once you have what the answer needs, stop calling tools and make the next message the direct answer to the user.</rule>",
    )
    .addLine(
      "<rule>Do not narrate tool mechanics unless the information helps the user understand the result, a limitation, or the next action.</rule>",
    )
    .addLine(
      "<rule>If the requested capability is unavailable, explain the concrete limitation and offer an available alternative.</rule>",
    )
    .addLine("</agent_tool_workflow>")
    .addLine();

  return builder.build();
}
