import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";
import { MessageActions } from "./MessageActions";

vi.mock("../InlineModelSelector", () => ({
	InlineModelSelector: ({ onModelSelect }: { onModelSelect: (modelId: string) => void }) => (
		<button type="button" onClick={() => onModelSelect("featured-model")}>
			Featured model
		</button>
	),
}));

const baseProps = {
	copied: false,
	copyMessageToClipboard: vi.fn(),
	feedbackState: "none" as const,
	isSubmittingFeedback: false,
	submitFeedback: vi.fn(),
	isSharedView: false,
};

function message(role: Message["role"]): Message {
	return {
		id: `${role}-message`,
		role,
		content: `${role} content`,
		created: 123,
		model: "test-model",
	};
}

describe("MessageActions", () => {
	it("branches directly from assistant messages", () => {
		const onBranch = vi.fn();

		render(<MessageActions {...baseProps} message={message("assistant")} onBranch={onBranch} />);

		fireEvent.click(screen.getByRole("button", { name: "Branch conversation" }));

		expect(onBranch).toHaveBeenCalledWith("assistant-message");
	});

	it("opens a model picker when branching from user messages", () => {
		const onBranch = vi.fn();

		render(<MessageActions {...baseProps} message={message("user")} onBranch={onBranch} />);

		fireEvent.click(screen.getByRole("button", { name: "Branch conversation" }));
		fireEvent.click(screen.getByRole("button", { name: "Featured model" }));

		expect(onBranch).toHaveBeenCalledWith("user-message", "featured-model");
	});
});
