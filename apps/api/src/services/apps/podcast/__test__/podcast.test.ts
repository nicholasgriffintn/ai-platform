import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { handlePodcastGenerateImage } from "../generate-image";
import { handlePodcastDetail } from "../get-details";
import { handlePodcastList } from "../list";
import { handlePodcastSummarise } from "../summarise";
import { handlePodcastTranscribe } from "../transcribe";
import { handlePodcastUpload } from "../upload";

const storage = {
	storeSourceFile: vi.fn(),
};

vi.mock("~/lib/storage", () => ({
	StorageService: class {
		static forPrivateAssets() {
			return storage;
		}
	},
}));
vi.mock("~/lib/chat/utils", () => ({ sanitiseInput: (value?: string) => value }));
vi.mock("~/utils/id", () => ({ generateId: () => "podcast-1" }));

function output(overrides: Partial<OutputRecord> = {}): OutputRecord {
	return {
		id: "output-1",
		created_by_user_id: 7,
		project_id: null,
		conversation_id: null,
		parent_output_id: null,
		capability_id: "podcasts",
		group_id: "podcast-1",
		kind: "upload",
		title: "Test podcast",
		status: "ready",
		sensitivity: "personal",
		content: JSON.stringify({
			title: "Test podcast",
			audioUrl: "https://api.test/sources/audio-1/content",
			createdAt: "2026-08-11T10:00:00Z",
		}),
		storage_key: null,
		mime_type: null,
		filename: null,
		byte_size: null,
		revision: 1,
		created_at: "2026-08-11T10:00:00Z",
		updated_at: null,
		...overrides,
	};
}

function context(outputs: Record<string, unknown>): ServiceContext {
	return {
		env: { DB: {}, AI: { run: vi.fn() } },
		ensureDatabase: () => undefined,
		repositories: { outputs },
	} as unknown as ServiceContext;
}

const user = { id: 7, email: "person@example.com" } as never;

describe("podcast outputs", () => {
	beforeEach(() => vi.clearAllMocks());

	it("stores an uploaded file as a source linked to a podcast output", async () => {
		const outputs = {
			createOutput: vi.fn().mockResolvedValue(output()),
			attachSources: vi.fn().mockResolvedValue(undefined),
		};
		storage.storeSourceFile.mockResolvedValue({
			sourceId: "audio-1",
			key: "podcasts/podcast-1/recording.mp3",
			url: "https://api.test/sources/audio-1/content",
		});

		const result = await handlePodcastUpload({
			context: context(outputs),
			request: {
				audio: {
					name: "episode.mp3",
					arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
				} as never,
				title: "Test podcast",
			},
			user,
		});

		expect(result.content).toContain("/sources/audio-1/content");
		expect(outputs.createOutput).toHaveBeenCalledWith(
			expect.objectContaining({ capabilityId: "podcasts", groupId: "podcast-1", kind: "upload" }),
		);
		expect(outputs.attachSources).toHaveBeenCalledWith("output-1", ["audio-1"]);
	});

	it("lists personal podcast sessions from canonical outputs", async () => {
		const outputs = { listPersonalOutputs: vi.fn().mockResolvedValue([output()]) };

		const result = await handlePodcastList({ context: context(outputs), user });

		expect(result).toEqual([
			expect.objectContaining({ id: "podcast-1", title: "Test podcast", status: "processing" }),
		]);
		expect(outputs.listPersonalOutputs).toHaveBeenCalledWith(7, "podcasts");
	});

	it("composes podcast detail from the output group", async () => {
		const outputs = {
			listPersonalOutputGroup: vi
				.fn()
				.mockResolvedValue([
					output(),
					output({ kind: "summary", content: '{"summary":"Concise summary"}' }),
				]),
		};

		const result = await handlePodcastDetail({
			context: context(outputs),
			podcastId: "podcast-1",
			user,
		});

		expect(result).toMatchObject({
			id: "podcast-1",
			summary: "Concise summary",
			status: "summarizing",
		});
	});

	it("returns cached transcription output", async () => {
		const outputs = {
			listPersonalOutputGroup: vi
				.fn()
				.mockResolvedValue([
					output({ kind: "transcribe", content: '{"transcriptionData":{"output":"Transcript"}}' }),
				]),
		};

		const result = await handlePodcastTranscribe({
			context: context(outputs),
			request: { podcastId: "podcast-1", numberOfSpeakers: 1, prompt: "Transcribe" },
			user,
		});

		expect(result).toMatchObject({ status: "success", data: { output: "Transcript" } });
	});

	it("returns cached summary output", async () => {
		const outputs = {
			listPersonalOutputGroup: vi
				.fn()
				.mockResolvedValue([
					output({ kind: "summary", content: '{"summary":"Summary","speakers":{"A":"Alex"}}' }),
				]),
		};

		const result = await handlePodcastSummarise({
			context: context(outputs),
			request: { podcastId: "podcast-1", speakers: { A: "Alex" } },
			user,
		});

		expect(result).toMatchObject({ status: "success", content: "Summary" });
	});

	it("returns cached image output", async () => {
		const outputs = {
			listPersonalOutputGroup: vi.fn().mockResolvedValue([
				output({
					kind: "image",
					content:
						'{"imageId":"image-1","imageKey":"podcasts/image.png","imageUrl":"https://api.test/outputs/image-1/content"}',
				}),
			]),
		};

		const result = await handlePodcastGenerateImage({
			context: context(outputs),
			request: { podcastId: "podcast-1" },
			user,
		});

		expect(result).toMatchObject({
			status: "success",
			data: { imageUrl: "https://api.test/outputs/image-1/content" },
		});
	});
});
