import { describe, expect, it } from "vitest";
import { z } from "zod";

import { errorResponse, HttpError, jsonResponse, parseJsonBody } from "./http.js";

describe("jsonResponse", () => {
	it("marks responses as no-store by default", () => {
		const response = jsonResponse({ ok: true });

		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
	});

	it("sets public cache headers and cache tags when requested", () => {
		const response = jsonResponse(
			{ jobs: [] },
			{
				cacheControl: "public, max-age=300, stale-while-revalidate=3600",
				cacheTag: "user:123",
				vary: "X-Training-User-ID",
			},
		);

		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=300, stale-while-revalidate=3600",
		);
		expect(response.headers.get("Cache-Tag")).toBe("user:123");
		expect(response.headers.get("Vary")).toBe("X-Training-User-ID");
	});
});

describe("parseJsonBody", () => {
	it("returns schema-validated request payloads", async () => {
		const request = new Request("https://training.worker.internal/jobs", {
			method: "POST",
			body: JSON.stringify({ jobId: "job-1" }),
		});

		await expect(parseJsonBody(request, z.object({ jobId: z.string().min(1) }))).resolves.toEqual({
			jobId: "job-1",
		});
	});

	it("turns malformed JSON into a stable client error", async () => {
		const request = new Request("https://training.worker.internal/jobs", {
			method: "POST",
			body: "{not json",
		});

		await expect(parseJsonBody(request, z.object({}))).rejects.toMatchObject({
			name: "HttpError",
			message: "Request body must be valid JSON",
			status: 400,
		});
	});
});

describe("errorResponse", () => {
	it("serialises HTTP errors with their status code", async () => {
		const response = errorResponse(new HttpError("Missing job", 404));

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: "Missing job" });
	});

	it("serialises Zod errors without exposing implementation details as the top-level error", async () => {
		const error = z.object({ jobId: z.string() }).safeParse({ jobId: 123 }).error;

		const response = errorResponse(error);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: "Invalid request",
			details: expect.any(Array),
		});
	});

	it("serialises unknown errors as internal failures", async () => {
		const response = errorResponse("boom");

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: "Unknown error" });
	});
});
