import { describe, expect, it } from "vitest";

import { headersToRecord, parseBearerToken, readHttpResponseBody, setDefaultHeader } from "../http";

describe("parseBearerToken", () => {
	it("accepts a single Bearer token", () => {
		expect(parseBearerToken("Bearer ak_test.123_abc-def")).toBe("ak_test.123_abc-def");
		expect(parseBearerToken("bearer jwt.payload.signature")).toBe("jwt.payload.signature");
	});

	it("rejects malformed authorization values", () => {
		expect(parseBearerToken(undefined)).toBeUndefined();
		expect(parseBearerToken("Basic credentials")).toBeUndefined();
		expect(parseBearerToken("prefix Bearer token")).toBeUndefined();
		expect(parseBearerToken("Bearer token suffix")).toBeUndefined();
	});
});

describe("http utilities", () => {
	it("maps headers to a plain record", () => {
		const headers = new Headers({
			"content-type": "application/json",
			"x-request-id": "request-1",
		});

		expect(headersToRecord(headers)).toEqual({
			"content-type": "application/json",
			"x-request-id": "request-1",
		});
	});

	it("sets default headers case-insensitively", () => {
		const headers = { "content-type": "text/plain" };

		setDefaultHeader(headers, "Content-Type", "application/json");
		setDefaultHeader(headers, "Accept", "application/json");

		expect(headers).toEqual({
			Accept: "application/json",
			"content-type": "text/plain",
		});
	});

	it("reads JSON response bodies", async () => {
		const response = new Response(JSON.stringify({ ok: true }));

		await expect(readHttpResponseBody(response)).resolves.toEqual({
			body: { ok: true },
			format: "json",
			parsed: { ok: true },
			raw: '{"ok":true}',
		});
	});

	it("falls back to text response bodies", async () => {
		const response = new Response("not json");

		await expect(readHttpResponseBody(response)).resolves.toEqual({
			body: "not json",
			format: "text",
			parsed: null,
			raw: "not json",
		});
	});
});
