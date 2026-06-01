import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LiveChatModeControls, LiveSessionComposerControls } from "./LiveChatModeControls";

describe("LiveChatModeControls", () => {
	it("shows usable live provider choices", () => {
		const onProviderChange = vi.fn();

		render(
			<LiveChatModeControls
				lastEvent="Ready"
				microphoneEnabled={true}
				onProviderChange={onProviderChange}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={vi.fn()}
				provider="openai"
				status="idle"
				videoEnabled={false}
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
				microphoneEnabled={true}
				onProviderChange={vi.fn()}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={onStart}
				onStop={onStop}
				onVideoEnabledChange={vi.fn()}
				provider="openai"
				status="idle"
				videoEnabled={false}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Start live session" }));
		expect(onStart).toHaveBeenCalledTimes(1);

		rerender(
			<LiveChatModeControls
				lastEvent="Connected"
				microphoneEnabled={true}
				onProviderChange={vi.fn()}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={onStart}
				onStop={onStop}
				onVideoEnabledChange={vi.fn()}
				provider="openai"
				status="active"
				videoEnabled={false}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Stop live session" }));
		expect(onStop).toHaveBeenCalledTimes(1);
	});

	it("can show provider settings without duplicating session controls", () => {
		render(
			<LiveChatModeControls
				lastEvent="Ready"
				microphoneEnabled={true}
				onProviderChange={vi.fn()}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={vi.fn()}
				provider="openai"
				showSessionControls={false}
				status="idle"
				videoEnabled={false}
			/>,
		);

		expect(screen.getByRole("radio", { name: /OpenAI Realtime/i })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Start live session" })).not.toBeInTheDocument();
	});

	it("renders composer session controls", () => {
		const onStart = vi.fn();
		const onMicrophoneEnabledChange = vi.fn();

		render(
			<LiveSessionComposerControls
				lastEvent="Ready"
				inputAudioLevel={0.45}
				microphoneEnabled={true}
				onMicrophoneEnabledChange={onMicrophoneEnabledChange}
				onStart={onStart}
				onStop={vi.fn()}
				onVideoEnabledChange={vi.fn()}
				outputAudioLevel={0}
				status="idle"
				videoEnabled={false}
				videoSupported={true}
			/>,
		);

		expect(screen.getByRole("meter", { name: "Microphone audio level" })).toHaveAttribute(
			"aria-valuenow",
			"0",
		);
		fireEvent.click(screen.getByRole("button", { name: "Start live session" }));
		expect(onStart).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByRole("button", { name: "Turn microphone off" }));
		expect(onMicrophoneEnabledChange).toHaveBeenCalledWith(false);
	});

	it("prioritises assistant output levels in the composer meter", () => {
		render(
			<LiveSessionComposerControls
				inputAudioLevel={0.2}
				lastEvent="Assistant speaking"
				microphoneEnabled={true}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={vi.fn()}
				outputAudioLevel={0.68}
				status="active"
				videoEnabled={false}
				videoSupported={true}
			/>,
		);

		expect(screen.getByRole("meter", { name: "Assistant audio level" })).toHaveAttribute(
			"aria-valuenow",
			"68",
		);
	});

	it("toggles microphone and camera controls in panel controls", () => {
		const onMicrophoneEnabledChange = vi.fn();
		const onVideoEnabledChange = vi.fn();

		render(
			<LiveChatModeControls
				lastEvent="Ready"
				microphoneEnabled={true}
				onProviderChange={vi.fn()}
				onMicrophoneEnabledChange={onMicrophoneEnabledChange}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={onVideoEnabledChange}
				provider="google-ai-studio"
				status="idle"
				videoEnabled={false}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Turn microphone off" }));
		fireEvent.click(screen.getByRole("button", { name: "Turn camera on" }));

		expect(onMicrophoneEnabledChange).toHaveBeenCalledWith(false);
		expect(onVideoEnabledChange).toHaveBeenCalledWith(true);
	});
});
