import { describe, expect, it } from "vitest";
import { z } from "zod";

import { errorResponse, HttpError, parseJsonBody } from "./http.js";

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
