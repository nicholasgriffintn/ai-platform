import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorageService } from "../storage";

const mockBucket = {
	get: vi.fn(),
	put: vi.fn(),
};

describe("StorageService", () => {
	let storageService: StorageService;

	beforeEach(() => {
		vi.clearAllMocks();
		storageService = new StorageService(mockBucket as any);
	});

	describe("getObject", () => {
		it("should return base64 encoded object when found", async () => {
			const testData = new Uint8Array([72, 101, 108, 108, 111]);
			const mockObject = {
				arrayBuffer: vi.fn().mockResolvedValue(testData.buffer),
			};
			mockBucket.get.mockResolvedValue(mockObject);

			const result = await storageService.getObject("test-key");

			expect(result).toBe(btoa("Hello"));
			expect(mockBucket.get).toHaveBeenCalledWith("test-key");
		});

		it("should return null when object not found", async () => {
			mockBucket.get.mockResolvedValue(null);

			const result = await storageService.getObject("nonexistent-key");

			expect(result).toBeNull();
			expect(mockBucket.get).toHaveBeenCalledWith("nonexistent-key");
		});

		it("should handle empty object", async () => {
			const mockObject = {
				arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
			};
			mockBucket.get.mockResolvedValue(mockObject);

			const result = await storageService.getObject("empty-key");

			expect(result).toBe("");
			expect(mockBucket.get).toHaveBeenCalledWith("empty-key");
		});

		it("should handle array buffer conversion errors", async () => {
			const mockObject = {
				arrayBuffer: vi.fn().mockRejectedValue(new Error("ArrayBuffer error")),
			};
			mockBucket.get.mockResolvedValue(mockObject);

			await expect(storageService.getObject("error-key")).rejects.toThrow("ArrayBuffer error");
		});

		it("should handle bucket get errors", async () => {
			mockBucket.get.mockRejectedValue(new Error("Bucket error"));

			await expect(storageService.getObject("error-key")).rejects.toThrow("Bucket error");
		});
	});

	describe("private assets", () => {
		it("allows a project member to read a project source created by another member", async () => {
			mockBucket.get.mockResolvedValue({
				arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("pdf").buffer),
			});
			const repositories = {
				sources: {
					getSource: vi.fn().mockResolvedValue({
						created_by_user_id: 7,
						project_id: "project-1",
						storage_key: "sources/brief.pdf",
						mime_type: "application/pdf",
					}),
				},
				outputs: { getOutput: vi.fn() },
				users: { getUserById: vi.fn().mockResolvedValue({ plan_id: "pro" }) },
				workspaces: {
					getProject: vi.fn().mockResolvedValue({ workspace_id: "workspace-1" }),
					getMembership: vi.fn().mockResolvedValue({ role: "member" }),
				},
			};
			const service = new StorageService(
				mockBucket as any,
				{
					env: { API_BASE_URL: "http://localhost:8787" },
					repositories,
				} as any,
			);

			await expect(
				service.getPrivateAssetDataUrl(
					"http://localhost:8787/sources/source-1/content",
					42,
					"http://localhost:8787",
					{ allowedMimeTypes: ["application/pdf"] },
				),
			).resolves.toBe("data:application/pdf;base64,cGRm");
			expect(repositories.workspaces.getMembership).toHaveBeenCalledWith("workspace-1", 42);
		});

		it("denies another user's personal source", async () => {
			const service = new StorageService(
				mockBucket as any,
				{
					env: { API_BASE_URL: "http://localhost:8787" },
					repositories: {
						sources: {
							getSource: vi.fn().mockResolvedValue({
								created_by_user_id: 7,
								project_id: null,
								storage_key: "sources/private.pdf",
								mime_type: "application/pdf",
							}),
						},
						outputs: { getOutput: vi.fn() },
						users: { getUserById: vi.fn().mockResolvedValue({ plan_id: "pro" }) },
						workspaces: { getProject: vi.fn(), getMembership: vi.fn() },
					},
				} as any,
			);

			await expect(
				service.getPrivateAssetDataUrl(
					"http://localhost:8787/sources/source-1/content",
					42,
					"http://localhost:8787",
				),
			).rejects.toMatchObject({ statusCode: 403 });
		});

		it("denies project assets when the requester no longer has Work access", async () => {
			const getMembership = vi.fn().mockResolvedValue({ role: "member" });
			const service = new StorageService(
				mockBucket as any,
				{
					env: { API_BASE_URL: "http://localhost:8787" },
					repositories: {
						sources: {
							getSource: vi.fn().mockResolvedValue({
								created_by_user_id: 7,
								project_id: "project-1",
								storage_key: "sources/brief.pdf",
								mime_type: "application/pdf",
							}),
						},
						outputs: { getOutput: vi.fn() },
						users: { getUserById: vi.fn().mockResolvedValue({ plan_id: "free" }) },
						workspaces: {
							getProject: vi.fn().mockResolvedValue({ workspace_id: "workspace-1" }),
							getMembership,
						},
					},
				} as any,
			);

			await expect(
				service.getPrivateAssetDataUrl(
					"http://localhost:8787/sources/source-1/content",
					42,
					"http://localhost:8787",
				),
			).rejects.toMatchObject({ statusCode: 403 });
			expect(getMembership).not.toHaveBeenCalled();
		});

		it("requires current project access from the original uploader", async () => {
			const service = new StorageService(
				mockBucket as any,
				{
					env: { API_BASE_URL: "http://localhost:8787" },
					repositories: {
						sources: {
							getSource: vi.fn().mockResolvedValue({
								created_by_user_id: 42,
								project_id: "project-1",
								storage_key: "sources/brief.pdf",
								mime_type: "application/pdf",
							}),
						},
						outputs: { getOutput: vi.fn() },
						users: { getUserById: vi.fn().mockResolvedValue({ plan_id: "pro" }) },
						workspaces: {
							getProject: vi.fn().mockResolvedValue({ workspace_id: "workspace-1" }),
							getMembership: vi.fn().mockResolvedValue(null),
						},
					},
				} as any,
			);

			await expect(
				service.getPrivateAssetDataUrl(
					"http://localhost:8787/sources/source-1/content",
					42,
					"http://localhost:8787",
				),
			).rejects.toMatchObject({ statusCode: 403 });
		});

		it("rejects private assets outside the requested media allowlist", async () => {
			const service = new StorageService(
				mockBucket as any,
				{
					env: { API_BASE_URL: "http://localhost:8787" },
					repositories: {
						sources: {
							getSource: vi.fn().mockResolvedValue({
								created_by_user_id: 42,
								project_id: null,
								storage_key: "sources/image.png",
								mime_type: "image/png",
							}),
						},
						outputs: { getOutput: vi.fn() },
						users: { getUserById: vi.fn() },
						workspaces: { getProject: vi.fn(), getMembership: vi.fn() },
					},
				} as any,
			);

			await expect(
				service.getPrivateAssetDataUrl(
					"http://localhost:8787/sources/source-1/content",
					42,
					"http://localhost:8787",
					{ allowedMimeTypes: ["application/pdf"] },
				),
			).rejects.toThrow("Unsupported asset type: image/png");
		});
	});

	describe("uploadObject", () => {
		it("should upload string data successfully", async () => {
			const testData = "Hello, World!";
			const testKey = "test-upload-key";
			mockBucket.put.mockResolvedValue(undefined);

			const result = await storageService.uploadObject(testKey, testData);

			expect(result).toBe(testKey);
			expect(mockBucket.put).toHaveBeenCalledWith(testKey, testData, undefined);
		});

		it("should upload ArrayBuffer data successfully", async () => {
			const testData = new ArrayBuffer(10);
			const testKey = "test-array-buffer-key";
			mockBucket.put.mockResolvedValue(undefined);

			const result = await storageService.uploadObject(testKey, testData);

			expect(result).toBe(testKey);
			expect(mockBucket.put).toHaveBeenCalledWith(testKey, testData, undefined);
		});

		it("should upload Uint8Array data successfully", async () => {
			const testData = new Uint8Array([1, 2, 3, 4, 5]);
			const testKey = "test-uint8array-key";
			mockBucket.put.mockResolvedValue(undefined);

			const result = await storageService.uploadObject(testKey, testData);

			expect(result).toBe(testKey);
			expect(mockBucket.put).toHaveBeenCalledWith(testKey, testData, undefined);
		});

		it("should upload with options", async () => {
			const testData = "Hello, World!";
			const testKey = "test-options-key";
			const options = {
				contentType: "text/plain",
				contentLength: 13,
				metadata: "test-metadata",
			};
			mockBucket.put.mockResolvedValue(undefined);

			const result = await storageService.uploadObject(testKey, testData, options);

			expect(result).toBe(testKey);
			expect(mockBucket.put).toHaveBeenCalledWith(testKey, testData, options);
		});

		it("should handle bucket put errors", async () => {
			const testData = "Hello, World!";
			const testKey = "test-error-key";
			mockBucket.put.mockRejectedValue(new Error("Upload failed"));

			await expect(storageService.uploadObject(testKey, testData)).rejects.toThrow("Upload failed");
		});

		it("should handle empty string data", async () => {
			const testData = "";
			const testKey = "test-empty-key";
			mockBucket.put.mockResolvedValue(undefined);

			const result = await storageService.uploadObject(testKey, testData);

			expect(result).toBe(testKey);
			expect(mockBucket.put).toHaveBeenCalledWith(testKey, testData, undefined);
		});

		it("should handle empty ArrayBuffer", async () => {
			const testData = new ArrayBuffer(0);
			const testKey = "test-empty-buffer-key";
			mockBucket.put.mockResolvedValue(undefined);

			const result = await storageService.uploadObject(testKey, testData);

			expect(result).toBe(testKey);
			expect(mockBucket.put).toHaveBeenCalledWith(testKey, testData, undefined);
		});
	});
});
