import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/lib/context/serviceContext";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters, IEnv, IUser } from "~/types";
import { ErrorType } from "~/utils/errors";
import { resolvePrivateAssetUrls } from "../privateAssets";

function createParams(content: ChatCompletionParameters["messages"][number]["content"]) {
	const env: IEnv = Object.create(null);
	const user: IUser = Object.assign(Object.create(null), { id: 42 });
	return {
		env,
		context: createServiceContext({ env, user }),
		model: "claude-opus-4-6",
		messages: [{ role: "user" as const, content }],
	};
}

function createStorage() {
	const storage: StorageService = Object.create(null);
	storage.getPrivateAssetDataUrl = vi.fn(async (_url, _userId, _assetsUrl, options) => {
		if (options?.allowedMimeTypes?.includes("application/pdf")) {
			return "data:application/pdf;base64,cGRm";
		}
		return "data:image/png;base64,aW1hZ2U=";
	});
	return storage;
}

describe("resolvePrivateAssetUrls", () => {
	beforeEach(() => vi.clearAllMocks());

	it("resolves private images and documents before provider formatting", async () => {
		const storage = createStorage();
		const result = await resolvePrivateAssetUrls({
			params: createParams([
				{ type: "image_url", image_url: { url: "http://localhost:8787/sources/image/content" } },
				{
					type: "document_url",
					document_url: {
						url: "http://localhost:8787/sources/document/content",
						name: "brief.pdf",
					},
				},
			]),
			storageService: storage,
			assetsUrl: "http://localhost:8787",
		});

		expect(result.messages[0].content).toEqual([
			{ type: "image_url", image_url: { url: "data:image/png;base64,aW1hZ2U=" } },
			{
				type: "document_url",
				document_url: {
					url: "data:application/pdf;base64,cGRm",
					name: "brief.pdf",
				},
			},
		]);
		expect(storage.getPrivateAssetDataUrl).toHaveBeenCalledWith(
			"http://localhost:8787/sources/document/content",
			42,
			"http://localhost:8787",
			{ allowedMimeTypes: ["application/pdf"] },
		);
	});

	it("resolves private audio URLs before provider formatting", async () => {
		const storage = createStorage();
		storage.getPrivateAssetDataUrl = vi.fn().mockResolvedValue("data:audio/wav;base64,YXVkaW8=");

		const result = await resolvePrivateAssetUrls({
			params: createParams([
				{
					type: "audio_url",
					audio_url: { url: "http://localhost:8787/sources/audio/content" },
				},
			]),
			storageService: storage,
			assetsUrl: "http://localhost:8787",
		});

		expect(result.messages[0].content).toEqual([
			{ type: "audio_url", audio_url: { url: "data:audio/wav;base64,YXVkaW8=" } },
		]);
		expect(storage.getPrivateAssetDataUrl).toHaveBeenCalledWith(
			"http://localhost:8787/sources/audio/content",
			42,
			"http://localhost:8787",
			{ allowedMimePrefixes: ["audio/"] },
		);
	});

	it("leaves external asset URLs unchanged", async () => {
		const storage = createStorage();
		storage.getPrivateAssetDataUrl = vi.fn().mockResolvedValue(null);
		const params = createParams([
			{ type: "image_url", image_url: { url: "https://example.com/image.png" } },
		]);

		const result = await resolvePrivateAssetUrls({ params, storageService: storage });

		expect(result).toBe(params);
	});

	it("preserves private asset authorisation failures", async () => {
		const storage = createStorage();
		storage.getPrivateAssetDataUrl = vi.fn().mockRejectedValue({ type: ErrorType.FORBIDDEN });

		await expect(
			resolvePrivateAssetUrls({
				params: createParams([
					{
						type: "document_url",
						document_url: { url: "http://localhost:8787/sources/document/content" },
					},
				]),
				storageService: storage,
			}),
		).rejects.toMatchObject({ type: ErrorType.FORBIDDEN });
	});
});
