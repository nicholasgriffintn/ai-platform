import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationSurface, SampleQuestionList, type SuggestedQuestion } from "./index";

afterEach(cleanup);

describe("SampleQuestionList", () => {
	it("reports controlled question, refresh, and difficulty choices", () => {
		const question: SuggestedQuestion = {
			category: "coding",
			id: "one",
			label: "Explain this project",
			prompt: "Explain this project to me",
		};
		const onSelect = vi.fn();
		const onRefresh = vi.fn();
		const onChallengingChange = vi.fn();
		render(
			<SampleQuestionList
				questions={[question]}
				showRefresh
				onRefresh={onRefresh}
				onChallengingChange={onChallengingChange}
				onSelect={onSelect}
			/>,
		);
		const questionButton = screen.getByRole("button", { name: question.label });
		const refreshButton = screen.getByRole("button", { name: "Refresh" });
		const challengingInput = screen.getByRole("checkbox", { name: "Hard" });

		expect(questionButton.querySelector("svg")).not.toBeNull();
		expect(refreshButton.querySelector("svg")).not.toBeNull();
		expect(
			challengingInput.nextElementSibling?.classList.contains(
				"polychat-conversation-challenging-track",
			),
		).toBe(true);

		fireEvent.click(questionButton);
		fireEvent.click(refreshButton);
		fireEvent.click(challengingInput);

		expect(onSelect).toHaveBeenCalledWith(question);
		expect(onRefresh).toHaveBeenCalledOnce();
		expect(onChallengingChange).toHaveBeenCalledWith(true);
		expect(challengingInput).toHaveProperty("checked", false);
	});

	it("exposes its loading state instead of stale choices", () => {
		render(<SampleQuestionList questions={[]} isLoading onSelect={vi.fn()} />);
		expect(screen.getByRole("status", { name: "Loading suggested questions" })).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});
});

describe("ConversationSurface", () => {
	it("renders a complete controlled conversation and emits composer intents", () => {
		const onChange = vi.fn();
		const onSubmit = vi.fn();
		render(
			<ConversationSurface
				controller={{
					messages: [{ id: "message-1", role: "assistant", content: "Hello" }],
					composer: { value: " Next question ", onChange, onSubmit },
				}}
			/>,
		);

		fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
			target: { value: "Changed" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		expect(screen.getByText("Hello")).toBeTruthy();
		expect(onChange).toHaveBeenCalledWith("Changed");
		expect(onSubmit).toHaveBeenCalledWith("Next question");
	});

	it("models an unavailable composer explicitly", () => {
		render(
			<ConversationSurface
				controller={{
					messages: [],
					composer: {
						value: "Hello",
						unavailableReason: "Sign in to send messages",
						onChange: vi.fn(),
						onSubmit: vi.fn(),
					},
				}}
			/>,
		);

		expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
		expect(screen.getByText("Sign in to send messages")).toBeTruthy();
	});
});
