import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ModelConfigItem } from "@assistant/schemas";
import type { Message } from "~/types";
import { ChatMessage } from ".";

const assistantMessage: Message = {
	id: "assistant-message",
	role: "assistant",
	content: "Assistant content",
	created: 123,
	model: "provider/big-pickle",
};

describe("ChatMessage", () => {
	it("uses resolved model config for assistant model icons", () => {
		const modelConfig: ModelConfigItem = {
			id: "big-pickle",
			name: "Big Pickle",
			matchingModel: "provider/big-pickle",
			provider: "openrouter",
		};

		render(<ChatMessage message={assistantMessage} modelConfig={modelConfig} />);

		expect(screen.getByRole("img", { name: "Big Pickle by openrouter" })).toBeInTheDocument();
		expect(screen.getByText("Assistant content")).toBeInTheDocument();
	});

	it("uses resolved model avatars when configured", () => {
		const modelConfig: ModelConfigItem = {
			id: "big-pickle",
			name: "Big Pickle",
			matchingModel: "provider/big-pickle",
			provider: "openrouter",
			avatarUrl: "https://example.com/big-pickle.png",
		};

		render(<ChatMessage message={assistantMessage} modelConfig={modelConfig} />);

		const icon = screen.getByRole("img", { name: "Big Pickle" });
		expect(icon).toHaveAttribute("src", "https://example.com/big-pickle.png");
	});

	it("falls back to the stored message model when no model config is available", () => {
		render(<ChatMessage message={assistantMessage} />);

		expect(screen.getByRole("img", { name: "provider/big-pickle" })).toBeInTheDocument();
	});

	it("renders assistant model icons before content arrives", () => {
		render(
			<ChatMessage
				message={{
					...assistantMessage,
					content: "",
				}}
			/>,
		);

		expect(screen.getByRole("img", { name: "provider/big-pickle" })).toBeInTheDocument();
	});

	it("renders assistant content when final message parts do not include text", () => {
		render(
			<ChatMessage
				message={{
					...assistantMessage,
					content: "Hello! How can I help you today?",
					parts: [
						{
							type: "tool_use",
							name: "web_search",
							toolCallId: "call-1",
							input: {},
						},
					],
				}}
			/>,
		);

		expect(screen.getByText("Hello! How can I help you today?")).toBeInTheDocument();
	});
});
