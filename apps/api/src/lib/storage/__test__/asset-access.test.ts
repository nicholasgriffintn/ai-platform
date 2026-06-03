import { describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { assertAssetAccess } from "../asset-access";
import type { StoredAsset } from "../asset-types";
import { ErrorType } from "~/utils/errors";

const privateAsset: StoredAsset = {
	id: "asset-private",
	key: "uploads/42/images/file.png",
	owner_user_id: 42,
	conversation_id: "conversation-1",
	message_id: "message-1",
	app_data_id: null,
	purpose: "chat_upload",
	mime_type: "image/png",
	filename: "file.png",
	byte_size: 10,
	created_at: "2026-06-03T00:00:00.000Z",
	updated_at: "2026-06-03T00:00:00.000Z",
};

const mockEnv = {
	DB: {},
} as IEnv;

function createContext(conversation: Record<string, unknown> | null) {
	const context = createServiceContext({ env: mockEnv });
	context.repositories.conversations.getConversation = vi.fn().mockResolvedValue(conversation);
	return context;
}

describe("assertAssetAccess", () => {
	it("allows the owning user to access a private asset", async () => {
		await expect(
			assertAssetAccess({
				asset: privateAsset,
				userId: 42,
				context: createContext(null),
			}),
		).resolves.toBeUndefined();
	});

	it("blocks another signed-in user from accessing a private asset", async () => {
		await expect(
			assertAssetAccess({
				asset: privateAsset,
				userId: 7,
				context: createContext(null),
			}),
		).rejects.toMatchObject({
			type: ErrorType.FORBIDDEN,
		});
	});

	it("allows anonymous access when the asset belongs to a public conversation", async () => {
		await expect(
			assertAssetAccess({
				asset: privateAsset,
				context: createContext({
					id: "conversation-1",
					is_public: 1,
				}),
			}),
		).resolves.toBeUndefined();
	});

	it("blocks anonymous access when the linked conversation is not public", async () => {
		await expect(
			assertAssetAccess({
				asset: privateAsset,
				context: createContext({
					id: "conversation-1",
					is_public: 0,
				}),
			}),
		).rejects.toMatchObject({
			type: ErrorType.FORBIDDEN,
		});
	});

	it("blocks anonymous access when the asset is not linked to a conversation", async () => {
		const assetWithoutConversation = {
			...privateAsset,
			conversation_id: null,
		};

		await expect(
			assertAssetAccess({
				asset: assetWithoutConversation,
				context: createContext(null),
			}),
		).rejects.toMatchObject({
			type: ErrorType.FORBIDDEN,
		});
	});
});
