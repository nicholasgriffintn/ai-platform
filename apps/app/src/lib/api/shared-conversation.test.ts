import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSharedConversationHistory } from "./shared-conversation";

function createMessages(count: number, offset = 0) {
	return Array.from({ length: count }, (_, index) => ({
		id: `message-${offset + index}`,
		role: "user",
		content: `Message ${offset + index}`,
	}));
}

function jsonResponse(data: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify({ data }), {
		headers: {
			"Content-Type": "application/json",
		},
		...init,
	});
}

describe("fetchSharedConversationHistory", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("paginates shared conversations until the final partial page", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					share_id: "shared-1",
					messages: createMessages(100),
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					share_id: "shared-1",
					messages: createMessages(2, 100),
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const result = await fetchSharedConversationHistory("shared-1");

		expect(result.messages).toHaveLength(102);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[0]).toContain("/chat/shared/shared-1?limit=100");
		expect(fetchMock.mock.calls[1]?.[0]).toContain(
			"/chat/shared/shared-1?limit=100&after=message-99",
		);
	});

	it("does not append duplicate messages from overlapping pages", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					share_id: "shared-1",
					messages: createMessages(100),
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					share_id: "shared-1",
					messages: createMessages(100),
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const result = await fetchSharedConversationHistory("shared-1");

		expect(result.messages).toHaveLength(100);
		expect(result.messages.map((message) => message.id)).toEqual(
			createMessages(100).map((message) => message.id),
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
