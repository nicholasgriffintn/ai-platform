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
	it("starts collapsed when conversation messages already exist", () => {
		render(<SandboxChatModeControls {...defaultProps} hasConversationMessages={true} />);

		expect(
			screen.queryByRole("button", { name: /Repository: nicholasgriffintn\/ai-platform/i }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Sandbox/i })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
	});

	it("collapses expanded sandbox controls when conversation messages appear", () => {
		const { rerender } = render(<SandboxChatModeControls {...defaultProps} />);

		expect(
			screen.getByRole("button", { name: /Repository: nicholasgriffintn\/ai-platform/i }),
		).toBeInTheDocument();

		rerender(<SandboxChatModeControls {...defaultProps} hasConversationMessages={true} />);

		expect(
			screen.queryByRole("button", { name: /Repository: nicholasgriffintn\/ai-platform/i }),
		).not.toBeInTheDocument();
	});
});
