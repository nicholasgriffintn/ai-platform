import { afterEach, describe, expect, it, vi } from "vitest";

import { executeOutlookOperation } from "../outlook";

describe("executeOutlookOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists Outlook calendar events through calendarView", async () => {
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ value: [] })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await executeOutlookOperation("outlook-token", "list_events", {
			timeMin: "2026-06-08T08:00:00.000Z",
			timeMax: "2026-06-09T08:00:00.000Z",
			maxResults: 5,
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		const requestUrl = new URL(String(url));
		expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe(
			"https://graph.microsoft.com/v1.0/me/calendarView",
		);
		expect(requestUrl.searchParams.get("startDateTime")).toBe("2026-06-08T08:00:00.000Z");
		expect(requestUrl.searchParams.get("endDateTime")).toBe("2026-06-09T08:00:00.000Z");
		expect(requestUrl.searchParams.get("$top")).toBe("5");
		expect(requestUrl.searchParams.get("$orderby")).toBe("start/dateTime");
		expect(init).toMatchObject({
			headers: expect.objectContaining({
				Authorization: "Bearer outlook-token",
			}),
		});
	});
});
