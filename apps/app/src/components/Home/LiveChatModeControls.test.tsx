import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LiveChatModeControls } from "./LiveChatModeControls";

describe("LiveChatModeControls", () => {
	it("shows usable live provider choices", () => {
		const onProviderChange = vi.fn();

		render(
			<LiveChatModeControls
				lastEvent="Ready"
				onProviderChange={onProviderChange}
				onStart={vi.fn()}
				onStop={vi.fn()}
				provider="openai"
				status="idle"
			/>,
		);

		expect(screen.getByRole("radio", { name: /OpenAI Realtime/i })).toHaveAttribute(
			"aria-checked",
			"true",
		);
		expect(screen.getByRole("radio", { name: /Gemini Live/i })).toBeEnabled();
		expect(screen.getByRole("radio", { name: /Mistral Realtime/i })).toBeEnabled();

		fireEvent.click(screen.getByRole("radio", { name: /Gemini Live/i }));

		expect(onProviderChange).toHaveBeenCalledWith("google-ai-studio");
	});

	it("starts and stops live sessions", () => {
		const onStart = vi.fn();
		const onStop = vi.fn();

		const { rerender } = render(
			<LiveChatModeControls
				lastEvent="Ready"
				onProviderChange={vi.fn()}
				onStart={onStart}
				onStop={onStop}
				provider="openai"
				status="idle"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Start live session" }));
		expect(onStart).toHaveBeenCalledTimes(1);

		rerender(
			<LiveChatModeControls
				lastEvent="Connected"
				onProviderChange={vi.fn()}
				onStart={onStart}
				onStop={onStop}
				provider="openai"
				status="active"
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Stop live session" }));
		expect(onStop).toHaveBeenCalledTimes(1);
	});
});
