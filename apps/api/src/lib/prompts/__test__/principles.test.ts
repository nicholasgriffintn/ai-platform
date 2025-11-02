import { describe, expect, it } from "vitest";
import { buildAssistantPrinciplesSection } from "../sections/principles";

describe("buildAssistantPrinciplesSection", () => {
	const baseOptions = {
		isAgent: false,
		supportsToolCalls: false,
		supportsArtifacts: false,
		supportsReasoning: true,
		responseMode: "normal",
		preferredLanguage: null,
	} as const;

	it("produces a full principle set by default", () => {
		const result = buildAssistantPrinciplesSection(baseOptions);

		expect(result).toContain("Start by understanding the user's core intent");
		expect(result).toContain("Proactively suggest useful next steps");
		expect(result).toContain(
			"For complex tasks, include a short 'Key steps' summary before the final answer so the user can follow your reasoning.",
		);
		expect(result).toContain("<assistant_principles>");
		expect(result).toContain("</assistant_principles>");
	});

	it("produces a compact principle set when requested", () => {
		const result = buildAssistantPrinciplesSection({
			...baseOptions,
			supportsToolCalls: true,
			supportsArtifacts: true,
			supportsReasoning: false,
			format: "compact",
			responseMode: "concise",
			preferredLanguage: "fr",
		});

		expect(result).toContain("Focus on the user's goal");
		expect(result).toContain(
			"Call tools only when they add value; prefer retrieval → browsing → code execution. Stop once you can answer confidently.",
		);
		expect(result).toContain(
			"Use tools for volatile facts (news, prices, laws, versions); never fabricate citations.",
		);
		expect(result).toContain(
			"For complex tasks, include a short 'Key steps' summary before the final answer.",
		);
		expect(result).toContain("Use artifacts for sizeable or reusable work");
		expect(result).toContain(
			"When native reasoning traces are unavailable, keep your reasoning summary clear while avoiding private scratchpads.",
		);
		expect(result).toContain("Keep answers tight but complete");
		expect(result).toContain("Default to replying in fr");
		expect(result).not.toContain("Proactively suggest useful next steps");
	});
});
