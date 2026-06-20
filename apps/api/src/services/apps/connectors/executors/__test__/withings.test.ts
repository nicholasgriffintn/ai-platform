import { afterEach, describe, expect, it, vi } from "vitest";

import { executeWithingsOperation } from "../withings";

describe("executeWithingsOperation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("retrieves Withings profile and devices through fixed user endpoints", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ status: 0, body: { user: {} } })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeWithingsOperation("token", "profile", {})).resolves.toEqual({
			status: 0,
			body: { user: {} },
		});
		await expect(executeWithingsOperation("token", "devices", {})).resolves.toEqual({
			status: 0,
			body: { user: {} },
		});

		expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
			"https://wbsapi.withings.net/v2/user?action=get",
		);
		expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
			"https://wbsapi.withings.net/v2/user?action=getdevice",
		);
		expect(fetchMock.mock.calls[0]?.[1]).toEqual(
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer token",
				}),
			}),
		);
	});

	it("retrieves measurements with bounded explicit filters", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ status: 0, body: { measuregrps: [] } })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeWithingsOperation("token", "measurements", {
				measureType: 1,
				category: 1,
				startTimestamp: 1760000000,
				endTimestamp: 1760086400,
			}),
		).resolves.toEqual({ status: 0, body: { measuregrps: [] } });

		expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
			"https://wbsapi.withings.net/measure?action=getmeas&startdate=1760000000&enddate=1760086400&meastype=1&category=1",
		);
	});

	it("retrieves activity and sleep summaries by date range", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ status: 0, body: { series: [] } })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeWithingsOperation("token", "activity", {
				startDate: "2026-06-01",
				endDate: "2026-06-08",
			}),
		).resolves.toEqual({ status: 0, body: { series: [] } });
		await expect(
			executeWithingsOperation("token", "sleep_summary", {
				startDate: "2026-06-01",
			}),
		).resolves.toEqual({ status: 0, body: { series: [] } });

		expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
			"https://wbsapi.withings.net/v2/measure?action=getactivity&startdateymd=2026-06-01&enddateymd=2026-06-08",
		);
		expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
			"https://wbsapi.withings.net/v2/sleep?action=getsummary&startdateymd=2026-06-01&enddateymd=2026-06-01",
		);
	});

	it("rejects invalid Withings date path input before fetching", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({})));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			executeWithingsOperation("token", "activity", { startDate: "../2026-06-01" }),
		).rejects.toThrow("startDate must be yyyy-MM-dd");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("treats non-zero Withings status responses as connector failures", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ status: 401, error: "Invalid token" })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(executeWithingsOperation("token", "profile", {})).rejects.toThrow(
			"Withings API request failed with status 401",
		);
	});
});
