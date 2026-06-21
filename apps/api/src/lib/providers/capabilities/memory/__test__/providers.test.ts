import { beforeEach, describe, expect, it, vi } from "vitest";

import { HindsightMemoryProvider, HonchoMemoryProvider } from "../providers";

const getRecipeConnectorAccessTokenMock = vi.hoisted(() => vi.fn());
const createMemoryMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/apps/connectors", () => ({
	getRecipeConnectorAccessToken: getRecipeConnectorAccessTokenMock,
}));

vi.mock("~/repositories/MemoryRepository", () => ({
	MemoryRepository: class {
		createMemory = createMemoryMock;
	},
}));

describe("external memory providers", () => {
	const env = { JWT_SECRET: "secret" } as any;
	const user = { id: 42 } as any;
	const serviceContext = {} as any;

	beforeEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
		getRecipeConnectorAccessTokenMock.mockResolvedValue({ accessToken: "provider-key" });
		createMemoryMock.mockResolvedValue({ id: "local-memory-id" });
	});

	it("stores Hindsight memories through retain without using an SDK", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ success: true, bank_id: "assistant_user_42", items_count: 1 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const provider = new HindsightMemoryProvider({
			baseUrl: "https://hindsight.vectorize.io",
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
			"https://hindsight.vectorize.io/v1/default/banks/assistant_user_42/memories",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer provider-key",
				}),
				body: expect.stringContaining("User prefers concise answers."),
			}),
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
});
