import { PromptBuilder } from "../builder";

export function buildAgentGuidelinesSection(): string {
  const builder = new PromptBuilder("<agent_tool_workflow>")
    .addLine()
    .addLine(
      "<rule>After each non-reasoning tool call, use `add_reasoning_step` to assess the result and set `nextStep` to `continue` or `finalAnswer`.</rule>",
    )
    .addLine(
      "<rule>When a reasoning step returns `nextStep=finalAnswer`, stop calling tools and make the next message the direct answer to the user.</rule>",
    )
    .addLine(
      "<rule>If `add_reasoning_step` is unavailable, assess the tool result directly and continue only when information essential to the answer is still missing.</rule>",
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
