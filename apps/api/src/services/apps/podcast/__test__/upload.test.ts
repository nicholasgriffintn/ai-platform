import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { handlePodcastUpload } from "../upload";

const mockRepositories = {
	appData: {
		createAppDataWithItem: vi.fn(),
	},
};

const mockStorageService = {
	uploadObject: vi.fn(),
};

vi.mock("~/repositories", () => ({
	RepositoryManager: {
		getInstance: vi.fn(() => mockRepositories),
	},
}));

vi.mock("~/lib/storage", () => ({
	StorageService: class {
		constructor() {
			return mockStorageService;
		}
	},
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(),
}));

describe("handlePodcastUpload", () => {
	const mockEnv = {
		DB: {},
		ASSETS_BUCKET: "test-bucket",
		PUBLIC_ASSETS_URL: "https://assets.example.com",
	} as any;
	const mockUser = { id: "user-123", email: "test@example.com" } as any;

	const mockRepositories = {
		appData: {
			createAppDataWithItem: vi.fn(),
		},
	};

	const mockContext = {
		env: mockEnv,
		user: mockUser,
		repositories: mockRepositories,
		ensureDatabase: vi.fn(),
		requireUser: vi.fn(() => mockUser),
		database: {} as any,
		requestId: undefined,
	} as any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const { sanitiseInput } = await import("~/lib/chat/utils");
		const { generateId } = await import("~/utils/id");
		vi.mocked(sanitiseInput).mockImplementation((input) => input);
		vi.mocked(generateId).mockReturnValue("podcast-123");
	});

	it("should upload audio file successfully", async () => {
		const mockFile = {
			arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
		} as any;

		const result = await handlePodcastUpload({
			context: mockContext,
			request: {
				audio: mockFile,
				title: "Test Podcast",
				description: "Test Description",
			},
			user: mockUser,
		});

		expect(result.status).toBe("success");
		expect(result.completion_id).toBe("podcast-123");
		expect(result.content).toBe(
			"Podcast Upload: [Listen Here](https://assets.example.com/podcasts/podcast-123/recording.mp3)",
		);
		expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
			"podcasts/podcast-123/recording.mp3",
			expect.any(ArrayBuffer),
			{
				contentType: "audio/mpeg",
				contentLength: 1024,
			},
		);
		expect(mockRepositories.appData.createAppDataWithItem).toHaveBeenCalledWith(
			"user-123",
			"podcasts",
			"podcast-123",
			"upload",
			expect.objectContaining({
				title: "Test Podcast",
				description: "Test Description",
				audioUrl:
					"https://assets.example.com/podcasts/podcast-123/recording.mp3",
				status: "ready",
			}),
		);
	});

	it("should handle audio URL without file upload", async () => {
		const result = await handlePodcastUpload({
			context: mockContext,
			request: {
				audioUrl: "https://example.com/audio.mp3",
				title: "Test Podcast",
				description: "Test Description",
			},
			user: mockUser,
		});

		expect(result.status).toBe("success");
		expect(result.completion_id).toBe("podcast-123");
		expect(result.content).toBe(
			"Podcast Upload: [Listen Here](https://example.com/audio.mp3)",
		);
		expect(mockStorageService.uploadObject).not.toHaveBeenCalled();
		expect(mockRepositories.appData.createAppDataWithItem).toHaveBeenCalledWith(
			"user-123",
			"podcasts",
			"podcast-123",
			"upload",
			expect.objectContaining({
				title: "Test Podcast",
				description: "Test Description",
				audioUrl: "https://example.com/audio.mp3",
				status: "ready",
			}),
		);
	});

	it("should use default title when none provided", async () => {
		await handlePodcastUpload({
			context: mockContext,
			request: {
				audioUrl: "https://example.com/audio.mp3",
			},
			user: mockUser,
		});

		expect(mockRepositories.appData.createAppDataWithItem).toHaveBeenCalledWith(
			"user-123",
			"podcasts",
			"podcast-123",
			"upload",
			expect.objectContaining({
				title: "Untitled Podcast",
			}),
		);
	});

	it("should sanitise title and description", async () => {
		const { sanitiseInput } = await import("~/lib/chat/utils");
		vi.mocked(sanitiseInput).mockImplementation(
			(input) => `sanitised_${input}`,
		);

		await handlePodcastUpload({
			context: mockContext,
			request: {
				audioUrl: "https://example.com/audio.mp3",
				title: "Unsafe <script>alert('xss')</script> Title",
				description: "Unsafe <script>alert('xss')</script> Description",
			},
			user: mockUser,
		});

		expect(vi.mocked(sanitiseInput)).toHaveBeenCalledWith(
			"Unsafe <script>alert('xss')</script> Title",
		);
		expect(vi.mocked(sanitiseInput)).toHaveBeenCalledWith(
			"Unsafe <script>alert('xss')</script> Description",
		);
		expect(mockRepositories.appData.createAppDataWithItem).toHaveBeenCalledWith(
			"user-123",
			"podcasts",
			"podcast-123",
			"upload",
			expect.objectContaining({
				title: "sanitised_Unsafe <script>alert('xss')</script> Title",
				description:
					"sanitised_Unsafe <script>alert('xss')</script> Description",
			}),
		);
	});

	it("should throw error for missing user ID", async () => {
		await expect(
			handlePodcastUpload({
				context: mockContext,
				request: { audioUrl: "https://example.com/audio.mp3" },
				user: {} as any,
			}),
		).rejects.toThrow(expect.any(AssistantError));
	});

	it("should throw error for missing audio when no URL provided", async () => {
		await expect(
			handlePodcastUpload({
				context: mockContext,
				request: {},
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));
	});

	it("should handle storage upload errors", async () => {
		const mockFile = {
			arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
		} as any;

		mockStorageService.uploadObject.mockRejectedValue(
			new Error("Storage failed"),
		);

		await expect(
			handlePodcastUpload({
				context: mockContext,
				request: {
					audio: mockFile,
					title: "Test Podcast",
				},
				user: mockUser,
			}),
		).rejects.toThrow(expect.any(AssistantError));
	});
});
