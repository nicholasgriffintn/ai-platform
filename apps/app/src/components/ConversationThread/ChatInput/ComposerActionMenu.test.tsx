import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComposerActionMenu } from "./ComposerActionMenu";

describe("ComposerActionMenu", () => {
	it("groups upload, voice, response audio, and tools behind one action trigger", () => {
		const onUploadClick = vi.fn();
		const onStartRecording = vi.fn();
		const onToggleAudio = vi.fn();

		render(
			<ComposerActionMenu
				autoPlayResponses={{
					enabled: false,
					isGenerating: false,
					isPlaying: false,
					onToggle: onToggleAudio,
				}}
				canUploadFiles={true}
				canUseVoice={true}
				isRecording={false}
				isTranscribing={false}
				isUploading={false}
				onStartRecording={onStartRecording}
				onStopRecording={vi.fn()}
				onUploadClick={onUploadClick}
				tools={<div>Tool toggles</div>}
				uploadIcon={<span aria-hidden="true">file</span>}
				uploadLabel="Upload files"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open composer actions" }));

		fireEvent.click(screen.getByRole("button", { name: /Attach file/i }));
		fireEvent.click(screen.getByRole("button", { name: /Voice input/i }));
		fireEvent.click(screen.getByRole("button", { name: /Response audio/i }));

		expect(screen.getByText("Tool toggles")).toBeInTheDocument();
		expect(onUploadClick).toHaveBeenCalledTimes(1);
		expect(onStartRecording).toHaveBeenCalledTimes(1);
		expect(onToggleAudio).toHaveBeenCalledTimes(1);
	});

	it("hides pro-only actions when they are unavailable", () => {
		render(
			<ComposerActionMenu
				canUploadFiles={false}
				canUseVoice={false}
				isRecording={false}
				isTranscribing={false}
				isUploading={false}
				onStartRecording={vi.fn()}
				onStopRecording={vi.fn()}
				onUploadClick={vi.fn()}
				tools={<div>Tool toggles</div>}
				uploadIcon={<span aria-hidden="true">file</span>}
				uploadLabel="Upload files"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open composer actions" }));

		expect(screen.queryByRole("button", { name: /Attach file/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Voice input/i })).not.toBeInTheDocument();
		expect(screen.getByText("Tool toggles")).toBeInTheDocument();
	});
});
