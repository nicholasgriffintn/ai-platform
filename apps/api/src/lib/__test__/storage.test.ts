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

			await expect(storageService.getObject("error-key")).rejects.toThrow(
				"ArrayBuffer error",
			);
		});

		it("should handle bucket get errors", async () => {
			mockBucket.get.mockRejectedValue(new Error("Bucket error"));

			await expect(storageService.getObject("error-key")).rejects.toThrow(
				"Bucket error",
			);
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

			const result = await storageService.uploadObject(
				testKey,
				testData,
				options,
			);

			expect(result).toBe(testKey);
			expect(mockBucket.put).toHaveBeenCalledWith(testKey, testData, options);
		});

		it("should handle bucket put errors", async () => {
			const testData = "Hello, World!";
			const testKey = "test-error-key";
			mockBucket.put.mockRejectedValue(new Error("Upload failed"));

			await expect(
				storageService.uploadObject(testKey, testData),
			).rejects.toThrow("Upload failed");
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
