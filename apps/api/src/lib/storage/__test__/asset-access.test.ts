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

	it("allows a project member to read an app asset created by another member", async () => {
		const context = createContext(null);
		context.requireUser = vi.fn().mockReturnValue({ id: 7, plan_id: "pro" });
		context.repositories.appData.getAppDataById = vi
			.fn()
			.mockResolvedValue({ id: "app-data-1", project_id: "project-1" });
		context.repositories.workspaces.getProject = vi
			.fn()
			.mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" });
		context.repositories.workspaces.getWorkspace = vi.fn().mockResolvedValue({ id: "workspace-1" });
		context.repositories.workspaces.getMembership = vi.fn().mockResolvedValue({ role: "member" });

		await expect(
			assertAssetAccess({
				asset: { ...privateAsset, app_data_id: "app-data-1", conversation_id: null },
				userId: 7,
				context,
			}),
		).resolves.toBeUndefined();
	});

	it("blocks project asset access when a member no longer has Pro", async () => {
		const context = createContext(null);
		context.requireUser = vi.fn().mockReturnValue({ id: 7, plan_id: "free" });
		context.repositories.appData.getAppDataById = vi
			.fn()
			.mockResolvedValue({ id: "app-data-1", project_id: "project-1" });

		await expect(
			assertAssetAccess({
				asset: { ...privateAsset, app_data_id: "app-data-1", conversation_id: null },
				userId: 7,
				context,
			}),
		).rejects.toMatchObject({ statusCode: 403 });
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
