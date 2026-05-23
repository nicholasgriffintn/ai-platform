import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SANDBOX_TIMEOUT_DEFAULT_SECONDS } from "~/types/sandbox";
import { SandboxChatModeControls } from "./SandboxChatModeControls";

const defaultProps = {
	selectedRepoKey: "repo-1",
	setSelectedRepoKey: vi.fn(),
	repoOptions: [
		{
			key: "repo-1",
			repo: "nicholasgriffintn/ai-platform",
			installationId: 1,
			isConfigured: true,
		},
	],
	normalisedRepo: "nicholasgriffintn/ai-platform",
	taskType: "feature-implementation" as const,
	setTaskType: vi.fn(),
	promptStrategy: "auto" as const,
	setPromptStrategy: vi.fn(),
	timeoutSecondsInput: String(SANDBOX_TIMEOUT_DEFAULT_SECONDS),
	setTimeoutSecondsInput: vi.fn(),
	hasValidTimeout: true,
	shouldCommit: true,
	setShouldCommit: vi.fn(),
	isReadOnlyTaskType: false,
	hasConnection: true,
};

describe("SandboxChatModeControls", () => {
	it("shows sandbox controls without a secondary collapse step", () => {
		render(<SandboxChatModeControls {...defaultProps} />);

		expect(
			screen.getByRole("button", { name: /Repository: nicholasgriffintn\/ai-platform/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Task: Feature implementation/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Prompt: Auto/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", {
				name: new RegExp(`Settings: ${SANDBOX_TIMEOUT_DEFAULT_SECONDS}s`, "i"),
			}),
		).toBeInTheDocument();
	});

	it("keeps controls visible across rerenders", () => {
		const { rerender } = render(<SandboxChatModeControls {...defaultProps} />);

		expect(
			screen.getByRole("button", { name: /Repository: nicholasgriffintn\/ai-platform/i }),
		).toBeInTheDocument();

		rerender(
			<SandboxChatModeControls {...defaultProps} normalisedRepo="nicholasgriffintn/assistant" />,
		);

		expect(
			screen.getByRole("button", { name: /Repository: nicholasgriffintn\/assistant/i }),
		).toBeInTheDocument();
	});
});
