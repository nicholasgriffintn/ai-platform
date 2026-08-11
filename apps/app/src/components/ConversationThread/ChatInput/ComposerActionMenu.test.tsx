import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SourceSummary } from "@assistant/schemas";

import { ComposerActionMenu } from "./ComposerActionMenu";

const source: SourceSummary = {
	id: "source-1",
	createdByUserId: 1,
	projectId: null,
	conversationId: null,
	connectionId: null,
	kind: "text",
	title: "Launch brief",
	status: "available",
	provider: null,
	externalUri: null,
	vectorId: null,
	metadata: {},
	file: null,
	createdAt: "2026-08-11T00:00:00.000Z",
	updatedAt: null,
};

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

		expect(screen.queryByRole("button", { name: /Voice input/i })).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Open composer actions" }));
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

	it("selects an existing source from the shared add menu", async () => {
		const onAttachSource = vi.fn().mockResolvedValue(true);
		render(
			<ComposerActionMenu
				canAttachSources={true}
				canUploadFiles={true}
				canUseVoice={false}
				isRecording={false}
				isTranscribing={false}
				isUploading={false}
				onAttachSource={onAttachSource}
				onStartRecording={vi.fn()}
				onStopRecording={vi.fn()}
				onUploadClick={vi.fn()}
				sourceScopeLabel="Personal sources"
				sources={[source]}
				uploadIcon={<span aria-hidden="true">file</span>}
				uploadLabel="Upload files"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open composer actions" }));
		fireEvent.click(screen.getByRole("button", { name: /Attach source/i }));

		expect(screen.getByText("Personal sources")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /^Launch brief/i }));

		expect(onAttachSource).toHaveBeenCalledWith("source-1");
	});

	it("keeps voice input open until transcription finishes", () => {
		const onStopRecording = vi.fn();
		const { rerender } = render(
			<ComposerActionMenu
				canUploadFiles={false}
				canUseVoice={true}
				isRecording={true}
				isTranscribing={false}
				isUploading={false}
				onStartRecording={vi.fn()}
				onStopRecording={onStopRecording}
				onUploadClick={vi.fn()}
				uploadIcon={<span aria-hidden="true">file</span>}
				uploadLabel="Upload files"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open composer actions" }));
		fireEvent.click(screen.getByRole("button", { name: /Stop voice input/i }));

		expect(onStopRecording).toHaveBeenCalledTimes(1);

		rerender(
			<ComposerActionMenu
				canUploadFiles={false}
				canUseVoice={true}
				isRecording={false}
				isTranscribing={true}
				isUploading={false}
				onStartRecording={vi.fn()}
				onStopRecording={onStopRecording}
				onUploadClick={vi.fn()}
				uploadIcon={<span aria-hidden="true">file</span>}
				uploadLabel="Upload files"
			/>,
		);

		expect(screen.getByText("Transcribing voice input")).toBeInTheDocument();

		rerender(
			<ComposerActionMenu
				canUploadFiles={false}
				canUseVoice={true}
				isRecording={false}
				isTranscribing={false}
				isUploading={false}
				onStartRecording={vi.fn()}
				onStopRecording={onStopRecording}
				onUploadClick={vi.fn()}
				uploadIcon={<span aria-hidden="true">file</span>}
				uploadLabel="Upload files"
			/>,
		);

		expect(screen.queryByRole("button", { name: /Voice input/i })).not.toBeInTheDocument();
	});
});
