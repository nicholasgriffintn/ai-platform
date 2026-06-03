import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LiveChatModeControls, LiveSessionComposerControls } from "./LiveChatModeControls";

const cameraDevices = [
	{ deviceId: "front-camera", label: "Front Camera" },
	{ deviceId: "desk-camera", label: "Desk Camera" },
];

describe("LiveChatModeControls", () => {
	it("shows usable live provider choices", () => {
		const onProviderChange = vi.fn();

		render(
			<LiveChatModeControls
				cameraDevices={[]}
				lastEvent="Ready"
				microphoneEnabled={true}
				onCameraDeviceChange={vi.fn()}
				onProviderChange={onProviderChange}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={vi.fn()}
				provider="openai"
				selectedCameraDeviceId=""
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
				cameraDevices={[]}
				lastEvent="Ready"
				microphoneEnabled={true}
				onCameraDeviceChange={vi.fn()}
				onProviderChange={vi.fn()}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={onStart}
				onStop={onStop}
				onVideoEnabledChange={vi.fn()}
				provider="openai"
				selectedCameraDeviceId=""
				status="idle"
				videoEnabled={false}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Start live session" }));
		expect(onStart).toHaveBeenCalledTimes(1);

		rerender(
			<LiveChatModeControls
				cameraDevices={[]}
				lastEvent="Connected"
				microphoneEnabled={true}
				onCameraDeviceChange={vi.fn()}
				onProviderChange={vi.fn()}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={onStart}
				onStop={onStop}
				onVideoEnabledChange={vi.fn()}
				provider="openai"
				selectedCameraDeviceId=""
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
				cameraDevices={[]}
				lastEvent="Ready"
				microphoneEnabled={true}
				onCameraDeviceChange={vi.fn()}
				onProviderChange={vi.fn()}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={vi.fn()}
				provider="openai"
				selectedCameraDeviceId=""
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
				cameraDevices={[]}
				lastEvent="Ready"
				inputAudioLevel={0.45}
				microphoneEnabled={true}
				onCameraDeviceChange={vi.fn()}
				onMicrophoneEnabledChange={onMicrophoneEnabledChange}
				onStart={onStart}
				onStop={vi.fn()}
				onVideoEnabledChange={vi.fn()}
				outputAudioLevel={0}
				selectedCameraDeviceId=""
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
				cameraDevices={[]}
				inputAudioLevel={0.2}
				lastEvent="Assistant speaking"
				microphoneEnabled={true}
				onCameraDeviceChange={vi.fn()}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={vi.fn()}
				outputAudioLevel={0.68}
				selectedCameraDeviceId=""
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
				cameraDevices={cameraDevices}
				lastEvent="Ready"
				microphoneEnabled={true}
				onCameraDeviceChange={vi.fn()}
				onProviderChange={vi.fn()}
				onMicrophoneEnabledChange={onMicrophoneEnabledChange}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={onVideoEnabledChange}
				provider="google-ai-studio"
				selectedCameraDeviceId="front-camera"
				status="idle"
				videoEnabled={false}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Turn microphone off" }));
		fireEvent.click(screen.getByRole("button", { name: "Turn camera on" }));

		expect(onMicrophoneEnabledChange).toHaveBeenCalledWith(false);
		expect(onVideoEnabledChange).toHaveBeenCalledWith(true);
	});

	it("selects the active camera from the camera dialog", () => {
		const onCameraDeviceChange = vi.fn();
		const onVideoEnabledChange = vi.fn();

		render(
			<LiveChatModeControls
				cameraDevices={cameraDevices}
				lastEvent="Ready"
				microphoneEnabled={true}
				onCameraDeviceChange={onCameraDeviceChange}
				onProviderChange={vi.fn()}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={onVideoEnabledChange}
				provider="google-ai-studio"
				selectedCameraDeviceId="front-camera"
				status="idle"
				videoEnabled={false}
			/>,
		);

		expect(screen.queryByRole("combobox", { name: "Camera" })).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Turn camera on" }));
		fireEvent.click(screen.getByRole("radio", { name: "Desk Camera" }));

		expect(onVideoEnabledChange).toHaveBeenCalledWith(true);
		expect(onCameraDeviceChange).toHaveBeenCalledWith("desk-camera");
	});

	it("renders camera preview inside the camera dialog", () => {
		const previewStream: MediaStream = Object.create(null);
		const onVideoEnabledChange = vi.fn();

		render(
			<LiveSessionComposerControls
				cameraDevices={cameraDevices}
				lastEvent="Ready"
				microphoneEnabled={true}
				onCameraDeviceChange={vi.fn()}
				onMicrophoneEnabledChange={vi.fn()}
				onStart={vi.fn()}
				onStop={vi.fn()}
				onVideoEnabledChange={onVideoEnabledChange}
				outputAudioLevel={0}
				selectedCameraDeviceId="front-camera"
				status="active"
				videoEnabled={false}
				videoPreviewStream={previewStream}
				videoSupported={true}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Turn camera on" }));

		expect(onVideoEnabledChange).toHaveBeenCalledWith(true);
		expect(screen.getByLabelText("Camera preview")).toBeInTheDocument();
	});
});
