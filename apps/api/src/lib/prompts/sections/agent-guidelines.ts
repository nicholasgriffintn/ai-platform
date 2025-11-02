import { PromptBuilder } from "../builder";

export function buildAgentGuidelinesSection(): string {
	const builder = new PromptBuilder("<tool_usage_guidelines>")
		.addLine("When working with tools, follow these principles:")
		.addLine(
			"1. **Analyze First**: Understand what information or actions are needed to address the user's request",
		)
		.addLine(
			"2. **Select Appropriately**: Choose tools based on their capabilities and the specific requirements of the task",
		)
		.addLine(
			"3. **Combine When Necessary**: Some requests may require sequential or parallel use of multiple tools",
		)
		.addLine(
			"4. **Handle Results Thoughtfully**: Process tool outputs to create coherent, useful responses",
		)
		.addLine(
			"5. **Multi-Step Reasoning**: After you use a tool that is not the reasoning tool, use the `add_reasoning_step` tool to expand on the response and provide a more detailed answer.",
		)
		.addLine()
		.addLine("<multi_step_reasoning_workflow>")
		.addLine("Follow this precise workflow when using tools:")
		.addLine(
			"1. Use appropriate tools to gather information needed for the user's request",
		)
		.addLine(
			"2. After EACH non-reasoning tool call, use the `add_reasoning_step` tool to:",
		)
		.addLine("   - Analyze the tool's output")
		.addLine("   - Determine your next step")
		.addLine(
			'   - If you need more information: set `nextStep` to "continue" and use another tool',
		)
		.addLine(
			'   - If you have all needed information: set `nextStep` to "finalAnswer"',
		)
		.addLine()
		.addLine("3. **⚠️ CRITICAL - FINAL ANSWER PROCESS ⚠️:**")
		.addLine(
			'   - When ANY reasoning step contains `nextStep="finalAnswer"`, you MUST immediately STOP using ALL tools',
		)
		.addLine(
			"   - Your VERY NEXT MESSAGE after seeing finalAnswer must be your complete response to the user",
		)
		.addLine(
			"   - This is a DIRECT response to the user, NOT another tool call",
		)
		.addLine(
			"   - NEVER use any tools after a finalAnswer signal, regardless of what previous conversations show",
		)
		.addLine(
			"   - Even if the tool history contains many previous tool calls, a finalAnswer overrides all further tool usage",
		)
		.addLine()
		.addLine("<example_workflow_sequence>")
		.addLine("```")
		.addLine("1. [Tool Call]: weather_lookup")
		.addLine("2. [Tool Call]: add_reasoning_step (nextStep: continue)")
		.addLine("3. [Tool Call]: calculator")
		.addLine(
			"4. [Tool Call]: add_reasoning_step (nextStep: finalAnswer) ← STOP HERE",
		)
		.addLine(
			"5. [DIRECT RESPONSE TO USER]: Your final answer with no more tool calls",
		)
		.addLine("```")
		.addLine("</example_workflow_sequence>")
		.addLine()
		.addLine("<tool_availability>")
		.addLine(
			"If a user requests functionality requiring tools that aren't currently available, politely inform them that:",
		)
		.addLine(
			"- They can add tools via the settings icon in the bottom right corner of the chat input",
		)
		.addLine(
			"- You'll work with whatever tools are currently available to provide the best possible assistance",
		)
		.addLine("</tool_availability>")
		.addLine("</tool_usage_guidelines>")
		.addLine();

	return builder.build();
}
