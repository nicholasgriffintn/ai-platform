import { beforeEach, describe, expect, it, vi } from "vitest";

import * as embeddingHelpers from "~/lib/providers/capabilities/embedding/helpers";
import { providerLibrary } from "~/lib/providers/library";
import { BuiltInMemoryProvider, HindsightMemoryProvider, HonchoMemoryProvider } from "../providers";

const getRecipeConnectorAccessTokenMock = vi.hoisted(() => vi.fn());
const createSourceMock = vi.hoisted(() => vi.fn());
const deleteSourceMock = vi.hoisted(() => vi.fn());
const getSourceMock = vi.hoisted(() => vi.fn());
const removeSourceFromCollectionsMock = vi.hoisted(() => vi.fn());
const embeddingDeleteMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/providers/capabilities/embedding/helpers", () => ({
	getEmbeddingProvider: vi.fn(() => ({
		delete: embeddingDeleteMock,
	})),
}));

vi.mock("~/services/apps/connectors", () => ({
	getRecipeConnectorAccessToken: getRecipeConnectorAccessTokenMock,
}));

describe("external memory providers", () => {
	const env = { JWT_SECRET: "secret" } as any;
	const user = { id: 42 } as any;
	const serviceContext = {
		repositories: {
			sources: {
				createSource: createSourceMock,
				deleteSource: deleteSourceMock,
				getSource: getSourceMock,
				removeSourceFromCollections: removeSourceFromCollectionsMock,
			},
		},
	} as any;

	beforeEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
		getRecipeConnectorAccessTokenMock.mockResolvedValue({ accessToken: "provider-key" });
		createSourceMock.mockResolvedValue({ id: "local-memory-id" });
		getSourceMock.mockResolvedValue({
			id: "local-memory-id",
			created_by_user_id: 42,
			kind: "memory",
			project_id: null,
			vector_id: "remote-message-id",
			metadata: JSON.stringify({ conversationId: "conversation-1" }),
		});
		deleteSourceMock.mockResolvedValue(undefined);
		removeSourceFromCollectionsMock.mockResolvedValue(undefined);
		embeddingDeleteMock.mockResolvedValue(undefined);
		vi.mocked(embeddingHelpers.getEmbeddingProvider).mockReturnValue({
			delete: embeddingDeleteMock,
		} as any);
	});

	it("uses the Hindsight API host from the memory provider registry", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ success: true, bank_id: "assistant_user_42", items_count: 1 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const provider = providerLibrary.memory("hindsight", {
			env,
			user,
			serviceContext,
		});

		await provider.storeMemory({
			text: "User prefers concise answers.",
			metadata: { category: "preference" },
			conversationId: "conversation-1",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.hindsight.vectorize.io/v1/default/banks/assistant_user_42/memories",
			expect.any(Object),
		);
	});

	it("stores Hindsight memories through retain without using an SDK", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ success: true, bank_id: "assistant_user_42", items_count: 1 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const provider = new HindsightMemoryProvider({
			baseUrl: "https://api.hindsight.vectorize.io",
			env,
			user,
			serviceContext,
		});

		await expect(
			provider.storeMemory({
				text: "User prefers concise answers.",
				metadata: { category: "preference" },
				conversationId: "conversation-1",
			}),
		).resolves.toMatchObject({
			id: "local-memory-id",
			provider: "hindsight",
		});

		expect(getRecipeConnectorAccessTokenMock).toHaveBeenCalledWith({
			context: serviceContext,
			userId: 42,
			provider: "hindsight",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.hindsight.vectorize.io/v1/default/banks/assistant_user_42/memories",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer provider-key",
				}),
				body: expect.stringContaining("User prefers concise answers."),
			}),
		);
	});

	it("falls back to the documented Hindsight memories recall endpoint", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith("/reflect")) {
				return Response.json({ detail: "reflect unavailable" }, { status: 500 });
			}

			if (url.endsWith("/memories/recall")) {
				return Response.json({
					results: [
						{
							id: "memory-1",
							text: "User prefers concise answers.",
							score: 0.9,
							type: "world",
						},
					],
				});
			}

			return Response.json({ detail: "unexpected endpoint" }, { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const provider = new HindsightMemoryProvider({
			baseUrl: "https://api.hindsight.vectorize.io",
			env,
			user,
			serviceContext,
		});

		await expect(provider.retrieveMemories("How should I answer?", { topK: 3 })).resolves.toEqual([
			{
				id: "memory-1",
				text: "User prefers concise answers.",
				score: 0.9,
				metadata: {
					provider: "hindsight",
					type: "world",
				},
			},
		]);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.hindsight.vectorize.io/v1/default/banks/assistant_user_42/memories/recall",
			expect.any(Object),
		);
	});

	it("retrieves Honcho memories through peer chat without using an SDK", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith("/chat")) {
				return Response.json({ content: "The user prefers concise answers." });
			}
			return Response.json({ id: "ok" });
		});
		vi.stubGlobal("fetch", fetchMock);

		const provider = new HonchoMemoryProvider({
			baseUrl: "https://api.honcho.dev",
			env,
			user,
			serviceContext,
		});

		await expect(provider.retrieveMemories("How should I answer?", { topK: 3 })).resolves.toEqual([
			{
				text: "The user prefers concise answers.",
				score: 1,
				metadata: { provider: "honcho", retrieval: "chat" },
			},
		]);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.honcho.dev/v3/workspaces/assistant_user_42/peers/user_42/chat",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer provider-key",
				}),
				body: expect.stringContaining('"reasoning_level":"low"'),
			}),
		);
	});

	it("stores Honcho memories in per-memory sessions so individual deletes are possible", async () => {
		const sessionUrls: string[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/sessions/") && url.endsWith("/messages")) {
				sessionUrls.push(url);
				return Response.json([{ id: "remote-message-id", content: "ok" }]);
			}
			return Response.json({ id: "ok" });
		});
		vi.stubGlobal("fetch", fetchMock);

		const provider = new HonchoMemoryProvider({
			baseUrl: "https://api.honcho.dev",
			env,
			user,
			serviceContext,
		});

		await provider.storeMemory({
			text: "User prefers concise answers.",
			metadata: { category: "preference" },
			conversationId: "conversation-1",
		});

		expect(sessionUrls).toHaveLength(1);
		expect(sessionUrls[0]).toMatch(
			/^https:\/\/api\.honcho\.dev\/v3\/workspaces\/assistant_user_42\/sessions\/honcho_memory_[^/]+\/messages$/,
		);
		expect(createSourceMock).toHaveBeenCalledWith(
			expect.objectContaining({
				conversationId: "conversation-1",
				kind: "memory",
				vectorId: expect.stringMatching(/^honcho_memory_/),
			}),
		);
	});

	it("deletes Honcho memory sessions before removing local rows", async () => {
		const fetchMock = vi.fn(async () => Response.json({}, { status: 202 }));
		vi.stubGlobal("fetch", fetchMock);

		const provider = new HonchoMemoryProvider({
			baseUrl: "https://api.honcho.dev",
			env,
			user,
			serviceContext,
		});

		await expect(provider.deleteMemory("local-memory-id")).resolves.toBe(true);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.honcho.dev/v3/workspaces/assistant_user_42/sessions/remote-message-id",
			expect.objectContaining({
				method: "DELETE",
				headers: expect.objectContaining({
					Authorization: "Bearer provider-key",
				}),
			}),
		);
		expect(deleteSourceMock).toHaveBeenCalledWith("local-memory-id");
		expect(removeSourceFromCollectionsMock).toHaveBeenCalledWith("local-memory-id");
	});

	it("does not remove local Hindsight memory when remote deletion fails", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ detail: "delete failed" }, { status: 500 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const provider = new HindsightMemoryProvider({
			baseUrl: "https://api.hindsight.vectorize.io",
			env,
			user,
			serviceContext,
		});

		await expect(provider.deleteMemory("local-memory-id")).resolves.toBe(false);

		expect(getSourceMock).toHaveBeenCalledWith("local-memory-id");
		expect(deleteSourceMock).not.toHaveBeenCalled();
		expect(removeSourceFromCollectionsMock).not.toHaveBeenCalled();
	});

	it("does not remove local built-in memory when vector deletion fails", async () => {
		embeddingDeleteMock.mockRejectedValue(new Error("vector delete failed"));

		const provider = new BuiltInMemoryProvider(env, user, null, serviceContext);

		await expect(provider.deleteMemory("local-memory-id")).resolves.toBe(false);

		expect(embeddingDeleteMock).toHaveBeenCalledWith(["remote-message-id"]);
		expect(deleteSourceMock).not.toHaveBeenCalled();
		expect(removeSourceFromCollectionsMock).not.toHaveBeenCalled();
	});
});
