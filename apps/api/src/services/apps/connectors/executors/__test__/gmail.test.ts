import { afterEach, describe, expect, it, vi } from "vitest";

import { executeGmailOperation } from "../gmail";

describe("executeGmailOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects draft header injection before calling Gmail", async () => {
		const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeGmailOperation("token", "create_draft", {
				to: "user@example.com\r\nBcc: attacker@example.com",
				subject: "Review",
				body: "Draft body",
			}),
		).rejects.toThrow("to must not contain email header control characters");

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("creates a Gmail draft for safe message fields", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "draft-1" })));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeGmailOperation("token", "create_draft", {
				to: "user@example.com",
				subject: "Review",
				body: "Draft body",
			}),
		).resolves.toEqual({ id: "draft-1" });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://gmail.googleapis.com/gmail/v1/users/me/drafts",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});
});
