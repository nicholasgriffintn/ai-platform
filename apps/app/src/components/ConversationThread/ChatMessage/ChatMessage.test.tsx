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

	it("renders weather tool results with the forecast widget", () => {
		render(
			<ChatMessage
				message={{
					...assistantMessage,
					content: "",
					parts: [
						{
							type: "tool_result",
							name: "get_weather",
							status: "success",
							content: "Weather Information\n\nTemperature: 20.05°C",
							data: {
								responseType: "custom",
								formattedName: "Get Weather",
								cod: 200,
								main: {
									temp: 20.05,
									feels_like: 19.78,
									temp_min: 17,
									temp_max: 22,
									humidity: 64,
								},
								weather: [{ main: "Clouds", description: "scattered clouds", icon: "03d" }],
								wind: { speed: 1.34, deg: 230 },
								name: "London",
								forecast: {
									hourly: [
										{
											time: "2026-06-30T12:00:00.000Z",
											temp: 20,
											description: "scattered clouds",
											icon: "03d",
											precipitationProbability: 8,
											humidity: 64,
											windSpeed: 1.34,
										},
									],
									daily: [
										{
											date: "2026-06-30",
											tempMin: 17,
											tempMax: 22,
											description: "scattered clouds",
											icon: "03d",
											precipitationProbability: 8,
										},
									],
								},
							},
						},
					],
				}}
			/>,
		);

		expect(screen.getByRole("region", { name: "Weather forecast for London" })).toBeInTheDocument();
		expect(screen.queryByText("Weather Information")).not.toBeInTheDocument();
		expect(screen.queryByText(/Temperature:/)).not.toBeInTheDocument();
	});

	it("renders artifact selection attachments on user messages", () => {
		render(
			<ChatMessage
				message={{
					id: "user-message",
					role: "user",
					content: [
						{ type: "text", text: "Make this firmer" },
						{
							type: "artifact_selection",
							artifact_selection: {
								artifact: {
									identifier: "launch-plan",
									type: "text/markdown",
									title: "Launch plan",
								},
								selectedText: "This paragraph needs work.",
								selectionStart: 12,
								selectionEnd: 38,
							},
						},
					],
					created: 123,
					model: "provider/big-pickle",
				}}
			/>,
		);

		expect(screen.getByText("selection from Launch plan")).toBeInTheDocument();
		expect(screen.getByText("Text · 26 B")).toBeInTheDocument();
		expect(screen.getByText("Make this firmer")).toBeInTheDocument();
	});

	it("renders inline HTML artifacts as preview-only output", async () => {
		render(
			<ChatMessage
				message={{
					...assistantMessage,
					content:
						'Here is the interface:<artifact identifier="orbit-demo" type="text/html" title="Orbit demo" display="inline"><section><h1>Orbit demo</h1></section></artifact>',
				}}
			/>,
		);

		expect(
			screen.getByRole("region", { name: "Inline artifact preview: Orbit demo" }),
		).toBeInTheDocument();
		expect(screen.getByText("Orbit demo")).toBeInTheDocument();
		expect(await screen.findByTitle("Code Preview")).toBeInTheDocument();
		expect(screen.queryByText(/Click here to open the code/i)).not.toBeInTheDocument();
		expect(
			screen
				.getByRole("region", { name: "Inline artifact preview: Orbit demo" })
				.querySelector("[data-inline-preview-viewport='true']"),
		).toHaveClass("h-[75vh]");
	});
});
