import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters, IEnv, IUser } from "~/types";
import { ErrorType } from "~/utils/errors";
import { resolvePrivateAssetImageUrls } from "../privateAssetImages";

function createParams(imageUrl: string, userId = 42): ChatCompletionParameters {
	const env: IEnv = Object.create(null);
	const user: IUser = Object.assign(Object.create(null), { id: userId });

	return {
		env,
		user,
		model: "gpt-5.5",
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: "what is this" },
					{ type: "image_url", image_url: { url: imageUrl } },
				],
			},
		],
	};
}

function createStorage(dataUrl: string | null = "data:image/png;base64,aW1hZ2U="): StorageService {
	const storage: StorageService = Object.create(null);
	storage.getPrivateAssetImageDataUrl = vi.fn().mockResolvedValue(dataUrl);
	return storage;
}

describe("resolvePrivateAssetImageUrls", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("converts owned private asset urls into data urls", async () => {
		const storage = createStorage();

		const result = await resolvePrivateAssetImageUrls({
			params: createParams("http://localhost:8787/assets/asset-123"),
			storageService: storage,
			assetsUrl: "http://localhost:8787",
		});

		expect(result.messages[0].content).toEqual([
			{ type: "text", text: "what is this" },
			{ type: "image_url", image_url: { url: "data:image/png;base64,aW1hZ2U=" } },
		]);
		expect(storage.getPrivateAssetImageDataUrl).toHaveBeenCalledWith(
			"http://localhost:8787/assets/asset-123",
			42,
			"http://localhost:8787",
		);
	});

	it("leaves external image urls unchanged", async () => {
		const params = createParams("https://example.com/image.png");
		const storage = createStorage(null);

		const result = await resolvePrivateAssetImageUrls({
			params,
			storageService: storage,
			assetsUrl: "http://localhost:8787",
		});

		expect(result).toBe(params);
		expect(storage.getPrivateAssetImageDataUrl).toHaveBeenCalledWith(
			"https://example.com/image.png",
			42,
			"http://localhost:8787",
		);
	});

	it("rejects private asset urls owned by another user", async () => {
		const storage = createStorage();
		storage.getPrivateAssetImageDataUrl = vi.fn().mockRejectedValue({
			type: ErrorType.FORBIDDEN,
		});

		await expect(
			resolvePrivateAssetImageUrls({
				params: createParams("http://localhost:8787/assets/asset-123"),
				storageService: storage,
				assetsUrl: "http://localhost:8787",
			}),
		).rejects.toMatchObject({
			type: ErrorType.FORBIDDEN,
		});
	});
});
