import { afterEach, describe, expect, it, vi } from "vitest";

import { executeFitbitOperation } from "../fitbit";

describe("executeFitbitOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("retrieves the connected Fitbit profile", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ user: { encodedId: "user-1" } })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeFitbitOperation("token", "profile", {})).resolves.toEqual({
			user: { encodedId: "user-1" },
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.fitbit.com/1/user/-/profile.json",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});

	it("retrieves daily activity for a supplied date", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ summary: { steps: 12000 } })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeFitbitOperation("token", "daily_activity", { date: "2026-06-08" }),
		).resolves.toEqual({ summary: { steps: 12000 } });

		const [url] = fetchMock.mock.calls[0] ?? [""];
		expect(String(url)).toBe("https://api.fitbit.com/1/user/-/activities/date/2026-06-08.json");
	});

	it("retrieves sleep logs and heart-rate summaries for today by default", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeFitbitOperation("token", "sleep_logs", {})).resolves.toEqual({
			ok: true,
		});
		await expect(executeFitbitOperation("token", "heart_rate", {})).resolves.toEqual({
			ok: true,
		});

		expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
			"https://api.fitbit.com/1.2/user/-/sleep/date/today.json",
		);
		expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
			"https://api.fitbit.com/1/user/-/activities/heart/date/today/1d.json",
		);
	});

	it("rejects invalid date path segments", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({})));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeFitbitOperation("token", "daily_activity", { date: "../profile" }),
		).rejects.toThrow("date must be today or yyyy-MM-dd");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
