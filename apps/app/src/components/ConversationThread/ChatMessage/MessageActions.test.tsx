import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";
import { MessageActions, type MessageActionsProps } from "./MessageActions";

const audioPlay = vi.fn().mockResolvedValue(undefined);
const audioPause = vi.fn();
const audioLoad = vi.fn();

vi.mock("../InlineModelSelector", () => ({
	InlineModelSelector: ({ onModelSelect }: { onModelSelect: (modelId: string) => void }) => (
		<button type="button" onClick={() => onModelSelect("featured-model")}>
			Featured model
		</button>
	),
}));

vi.mock("../OpinionModelSelector", () => ({
	OpinionModelSelector: ({
		onSubmit,
	}: {
		onSubmit: (request: { mode: "second-opinion"; modelIds: string[] }) => void;
	}) => (
		<button
			type="button"
			onClick={() => onSubmit({ mode: "second-opinion", modelIds: ["opinion-model"] })}
		>
			Opinion model
		</button>
	),
}));

function message(role: Message["role"]): Message {
	return {
		id: `${role}-message`,
		role,
		content: `${role} content`,
		created: 123,
		model: "test-model",
	};
}

function messageActionsProps(message: Message): MessageActionsProps {
	return {
		message,
		copied: false,
		copyMessageToClipboard: vi.fn(),
		feedbackState: "none",
		isSubmittingFeedback: false,
		submitFeedback: vi.fn(),
		isSharedView: false,
	};
}

describe("MessageActions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.HTMLMediaElement.prototype.play = audioPlay;
		window.HTMLMediaElement.prototype.pause = audioPause;
		window.HTMLMediaElement.prototype.load = audioLoad;
	});

	it("branches directly from assistant messages", () => {
		const onBranch = vi.fn();

		render(<MessageActions {...messageActionsProps(message("assistant"))} onBranch={onBranch} />);

		fireEvent.click(screen.getByRole("button", { name: "Branch conversation" }));

		expect(onBranch).toHaveBeenCalledWith("assistant-message");
	});

	it("opens a model picker when branching from user messages", () => {
		const onBranch = vi.fn();

		render(<MessageActions {...messageActionsProps(message("user"))} onBranch={onBranch} />);

		fireEvent.click(screen.getByRole("button", { name: "Branch conversation" }));
		fireEvent.click(screen.getByRole("button", { name: "Featured model" }));

		expect(onBranch).toHaveBeenCalledWith("user-message", "featured-model");
	});

	it("opens a model picker when requesting a second opinion", () => {
		const onRequestOpinion = vi.fn();

		render(
			<MessageActions
				{...messageActionsProps(message("assistant"))}
				onRequestOpinion={onRequestOpinion}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Get second opinion" }));
		fireEvent.click(screen.getByRole("button", { name: "Opinion model" }));

		expect(onRequestOpinion).toHaveBeenCalledWith("assistant-message", {
			mode: "second-opinion",
			modelIds: ["opinion-model"],
		});
	});

	it("replays stored assistant speech audio", () => {
		const assistantMessage = {
			...message("assistant"),
			data: {
				speech: {
					audioUrl: "https://assets.example/tts/message.mp3",
					generatedAt: 123,
				},
			},
		};

		render(<MessageActions {...messageActionsProps(assistantMessage)} />);

		fireEvent.click(screen.getByRole("button", { name: "Replay response audio" }));

		expect(audioPlay).toHaveBeenCalledTimes(1);
	});

	it("stops stored assistant speech audio while it is playing", () => {
		const assistantMessage = {
			...message("assistant"),
			data: {
				speech: {
					audioUrl: "https://assets.example/tts/message.mp3",
					generatedAt: 123,
				},
			},
		};

		render(<MessageActions {...messageActionsProps(assistantMessage)} />);

		fireEvent.click(screen.getByRole("button", { name: "Replay response audio" }));
		fireEvent.click(screen.getByRole("button", { name: "Stop response audio" }));

		expect(audioPlay).toHaveBeenCalledTimes(1);
		expect(audioPause).toHaveBeenCalledTimes(1);
		expect(audioLoad).toHaveBeenCalledTimes(1);
	});
});
