import { describe, expect, it } from "vitest";

import {
	defaultShouldCommitForSandboxCommand,
	extractSandboxCommand,
	extractSandboxPushCommand,
	formatResultComment,
	parseIssueNumberFromAutomationPayload,
	parseSandboxAutomationCommand,
	parseSandboxShouldCommit,
} from "../github";

describe("github sandbox command helpers", () => {
	it("parses slash commands from issue comments", () => {
		const parsed = extractSandboxCommand("/review Check auth middleware");

		expect(parsed).toEqual({
			command: "review",
			task: "Check auth middleware",
		});
	});

	it("parses push command markers from commit messages", () => {
		const parsed = extractSandboxPushCommand(
			"feat: run checks [sandbox test: Run API tests]",
		);

		expect(parsed).toEqual({
			command: "test",
			task: "Run API tests",
		});
	});

	it("parses automation command payloads", () => {
		const parsed = parseSandboxAutomationCommand({
			client_payload: {
				command: "fix",
				task: "Fix webhook timeout",
			},
		});

		expect(parsed).toEqual({
			command: "fix",
			task: "Fix webhook timeout",
		});
	});

	it("parses shouldCommit and issue number from automation payloads", () => {
		const shouldCommit = parseSandboxShouldCommit({
			inputs: {
				should_commit: "true",
			},
		});
		const issueNumber = parseIssueNumberFromAutomationPayload({
			client_payload: {
				issue_number: "42",
			},
		});

		expect(shouldCommit).toBe(true);
		expect(issueNumber).toBe(42);
	});

	it("formats command-specific result comments", () => {
		const body = formatResultComment({
			command: "test",
			success: true,
			summary: "All tests passed",
			responseId: "resp-123",
		});

		expect(body).toContain("## Test Run Complete");
		expect(body).toContain("All tests passed");
		expect(body).toContain("resp-123");
	});

	it("uses commit defaults by command", () => {
		expect(defaultShouldCommitForSandboxCommand("implement")).toBe(true);
		expect(defaultShouldCommitForSandboxCommand("fix")).toBe(true);
		expect(defaultShouldCommitForSandboxCommand("review")).toBe(false);
		expect(defaultShouldCommitForSandboxCommand("test")).toBe(false);
	});
});
