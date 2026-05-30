import { FINETUNE_WORKER_TOKEN_HEADER, FINETUNE_WORKER_USER_ID_HEADER } from "@assistant/schemas";
import { describe, expect, it } from "vitest";

import { assertInternalRequest, getInternalUserId } from "./internalAuth.js";

const token = "worker-token";

function createInternalRequest(headers: Record<string, string> = {}): Request {
	return new Request("https://finetune.worker.internal/jobs", { headers });
}

describe("internal worker auth", () => {
	it("rejects worker requests when the shared token is not configured", () => {
		expect(() => assertInternalRequest(createInternalRequest(), {})).toThrow(
			"Training worker token is not configured",
		);
	});

	it("rejects requests without the shared token", () => {
		expect(() =>
			assertInternalRequest(createInternalRequest(), { FINETUNE_WORKER_TOKEN: token }),
		).toThrow("Unauthorized");
	});

	it("accepts requests with the shared token and internal user context", () => {
		const request = createInternalRequest({
			[FINETUNE_WORKER_TOKEN_HEADER]: token,
			[FINETUNE_WORKER_USER_ID_HEADER]: "42",
		});

		assertInternalRequest(request, { FINETUNE_WORKER_TOKEN: token });

		expect(getInternalUserId(request)).toBe(42);
	});

	it("rejects requests without internal user context", () => {
		const request = createInternalRequest({
			[FINETUNE_WORKER_TOKEN_HEADER]: token,
		});

		expect(() => getInternalUserId(request)).toThrow("Missing internal user context");
	});

	it("rejects invalid internal user context", () => {
		const request = createInternalRequest({
			[FINETUNE_WORKER_TOKEN_HEADER]: token,
			[FINETUNE_WORKER_USER_ID_HEADER]: "not-a-user-id",
		});

		expect(() => getInternalUserId(request)).toThrow("Invalid internal user context");
	});
});
