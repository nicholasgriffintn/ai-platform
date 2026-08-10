import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PodcastWorkflow } from "./PodcastWorkflow";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), process: vi.fn() }));

vi.mock("~/components/Uploader/SingleFileUploader", () => ({
	SingleFileUploader: () => <div>Audio uploader</div>,
}));
vi.mock("~/hooks/usePodcasts", () => ({
	useUploadPodcast: () => ({ isPending: false, mutateAsync: mocks.upload }),
	useProcessPodcast: () => ({ isPending: false, mutateAsync: mocks.process }),
}));

describe("PodcastWorkflow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.upload.mockResolvedValue({ response: { completion_id: "podcast-1" } });
	});

	it("keeps the original upload and processing steps", async () => {
		render(
			<MemoryRouter>
				<PodcastWorkflow basePath="/work/project/podcasts" projectId="project-1" />
			</MemoryRouter>,
		);

		expect(screen.getByText("Upload")).toBeInTheDocument();
		expect(screen.getByText("Process")).toBeInTheDocument();
		expect(screen.getByText("Complete")).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("Podcast Title *"), {
			target: { value: "Project podcast" },
		});
		fireEvent.click(screen.getByLabelText("Enter URL"));
		fireEvent.change(screen.getByLabelText("Audio URL * (MP3, WAV, M4A)"), {
			target: { value: "https://example.com/podcast.mp3" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Upload & Continue" }));

		await waitFor(() => {
			expect(screen.getByText("Processing Options")).toBeInTheDocument();
		});
		expect(screen.getByText("Transcribe Podcast")).toBeInTheDocument();
		expect(screen.getByText("Generate Summary")).toBeInTheDocument();
		expect(screen.getByText("Generate Cover Image")).toBeInTheDocument();
		expect(screen.getByLabelText("Number of Speakers")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Process Podcast" }));
		await waitFor(() => expect(mocks.process).toHaveBeenCalledTimes(3));
		expect(mocks.process).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ action: "transcribe", podcastId: "podcast-1" }),
		);
		expect(mocks.process).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ action: "summarise", podcastId: "podcast-1" }),
		);
		expect(mocks.process).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({ action: "generate-image", podcastId: "podcast-1" }),
		);
	});
});
