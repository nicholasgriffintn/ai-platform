import { describe, expect, it } from "vitest";

import type { SandboxRun, SandboxRunEvent } from "~/types/sandbox";
import {
	buildMessagesFromRun,
	buildSandboxDisplayMessages,
	getAssistantMessageFromEvent,
	isRunStatusActive,
} from "./helpers";

describe("sandbox connection helpers", () => {
	it("builds chat messages from a completed sandbox run", () => {
		const run = createRun({
			status: "completed",
			result: { summary: "Implemented the requested change." },
			events: [
				{
					type: "run_completed",
					result: { summary: "Implemented the requested change." },
					timestamp: "2026-05-18T10:05:00.000Z",
				},
			],
		});

		expect(buildMessagesFromRun(run)).toEqual([
			{
				id: "run-1-user",
				role: "user",
				content: "Improve the sandbox UI",
				createdAt: "2026-05-18T10:00:00.000Z",
			},
			{
				id: "run-1-assistant-1",
				role: "assistant",
				content: "Implemented the requested change.",
				createdAt: "2026-05-18T10:05:00.000Z",
			},
		]);
	});

	it("keeps command approval requests visible as assistant messages", () => {
		const event: SandboxRunEvent = {
			type: "command_approval_requested",
			command: "pnpm test",
		};

		expect(getAssistantMessageFromEvent(event)).toBe("Approval requested for command: pnpm test");
	});

	it("only treats queued and running runs as active", () => {
		expect(isRunStatusActive("queued")).toBe(true);
		expect(isRunStatusActive("running")).toBe(true);
		expect(isRunStatusActive("completed")).toBe(false);
		expect(isRunStatusActive("failed")).toBe(false);
	});

	it("converts sandbox events into normal chat messages", () => {
		const messages = buildSandboxDisplayMessages({
			messages: [
				{
					id: "user-1",
					role: "user",
					content: "please complete SW-101",
					createdAt: "2026-05-18T10:00:00.000Z",
				},
			],
			timeline: [
				{
					id: "event-1",
					receivedAt: "2026-05-18T10:01:00.000Z",
					event: {
						type: "command_started",
						command: "pnpm test",
						commandIndex: 1,
						commandTotal: 2,
					},
				},
			],
			selectedRun: undefined,
			latestPlan: {
				plan: "Run tests",
				updatedAt: "2026-05-18T10:00:30.000Z",
			},
		});

		expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "assistant"]);
		expect(String(messages[1].content)).toContain("Run tests");
		expect(String(messages[2].content)).toContain("command_started");
		expect(String(messages[2].content)).toContain("pnpm test");
	});
});

function createRun(overrides: Partial<SandboxRun> = {}): SandboxRun {
	return {
		runId: "run-1",
		installationId: 109793174,
		repo: "polychat/app",
		task: "Improve the sandbox UI",
		taskType: "feature-implementation",
		model: "mistral-large",
		shouldCommit: true,
		status: "running",
		startedAt: "2026-05-18T10:00:00.000Z",
		updatedAt: "2026-05-18T10:01:00.000Z",
		events: [],
		...overrides,
	};
}
