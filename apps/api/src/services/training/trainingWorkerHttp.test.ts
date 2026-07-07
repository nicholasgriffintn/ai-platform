import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

import { requestTrainingWorker } from "./trainingWorkerHttp";

describe("requestTrainingWorker", () => {
	it("passes the authenticated user id as service-binding props", async () => {
		const fetch = vi.fn(async () => Response.json({ ok: true }));
		const env = {
			TRAINING_WORKER_TOKEN: "worker-token",
			TRAINING_WORKER: { fetch },
		};

		await expect(
			requestTrainingWorker(env, "/jobs", z.object({ ok: z.literal(true) }), {
				userId: 123,
			}),
		).resolves.toEqual({ ok: true });

		expect(fetch).toHaveBeenCalledWith(expect.any(Request), {
			props: { userId: "123" },
		});
	});
});
