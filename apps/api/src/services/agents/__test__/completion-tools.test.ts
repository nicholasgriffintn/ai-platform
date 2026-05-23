import { describe, expect, it } from "vitest";

import { buildAgentSystemPrompt } from "../completion-tools";

describe("agent completion tools", () => {
	it("keeps few-shot prompt construction out of the completion request path", () => {
		const agent = {
			id: "agent-1",
			servers: null,
			team_role: null,
			system_prompt: "Follow the user's repo rules.",
			few_shot_examples: JSON.stringify([
				{
					input: "Review this change",
					output: "Findings first.",
				},
			]),
		} as Parameters<typeof buildAgentSystemPrompt>[0];

		expect(buildAgentSystemPrompt(agent)).toContain("Examples:");
	});
});
