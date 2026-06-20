import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getRecipeConnectorAccessToken: vi.fn(),
}));

vi.mock("../index", () => ({
	getRecipeConnectorAccessToken: mocks.getRecipeConnectorAccessToken,
}));

import { executeRecipeConnectorOperation } from "../operations";

describe("recipe connector operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getRecipeConnectorAccessToken.mockResolvedValue({ accessToken: "token" });
	});

	it("rejects unsupported provider operations before reading OAuth tokens", async () => {
		await expect(
			executeRecipeConnectorOperation({
				context: {} as Parameters<typeof executeRecipeConnectorOperation>[0]["context"],
				userId: 42,
				request: {
					provider: "gmail",
					operation: "delete_message",
					params: { id: "message-1" },
				},
			}),
		).rejects.toThrow("Unsupported recipe connector operation");

		expect(mocks.getRecipeConnectorAccessToken).not.toHaveBeenCalled();
	});

	it("rejects non-object operation params before reading OAuth tokens", async () => {
		await expect(
			executeRecipeConnectorOperation({
				context: {} as Parameters<typeof executeRecipeConnectorOperation>[0]["context"],
				userId: 42,
				request: {
					provider: "gmail",
					operation: "search_messages",
					params: ["not", "an", "object"] as unknown as Record<string, unknown>,
				},
			}),
		).rejects.toThrow("Connector operation params must be an object");

		expect(mocks.getRecipeConnectorAccessToken).not.toHaveBeenCalled();
	});
});
