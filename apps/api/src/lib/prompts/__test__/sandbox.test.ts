import { describe, expect, it } from "vitest";

import { returnSandboxPrompt } from "../sandbox";

describe("returnSandboxPrompt", () => {
	it("includes selected sandbox defaults for the tool call", () => {
		const prompt = returnSandboxPrompt({
			completion_id: "completion-1",
			input: "Fix the bug",
			date: "2026-05-23",
			mode: "normal",
			promptMode: "sandbox",
			options: {
				sandbox: {
					enabled: true,
					repo: "owner/repo",
					installationId: 123,
					taskType: "bug-fix",
					promptStrategy: "bug-fix",
					shouldCommit: false,
					timeoutSeconds: 900,
				},
			},
		});

		expect(prompt).toContain("chat-side controller for sandbox coding work");
		expect(prompt).toContain("Repository: owner/repo");
		expect(prompt).toContain("GitHub installation ID: 123");
		expect(prompt).toContain("Task type: bug-fix");
		expect(prompt).toContain("Prompt strategy: bug-fix");
		expect(prompt).toContain("Commit changes: no");
		expect(prompt).toContain("Timeout seconds: 900");
	});
});
