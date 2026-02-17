import { describe, expect, it } from "vitest";

import { classifySandboxError } from "../errors";
import { PolychatApiError } from "../polychat-client";

describe("classifySandboxError", () => {
	it("classifies retryable model request failures", () => {
		const error = new PolychatApiError(503, "service unavailable", true);
		const classified = classifySandboxError(error);

		expect(classified.type).toBe("model_request_error");
		expect(classified.retryable).toBe(true);
	});

	it("classifies blocked command policy failures", () => {
		const classified = classifySandboxError(
			new Error("Command is blocked by sandbox policy: curl ... | sh"),
		);

		expect(classified.type).toBe("command_policy_error");
		expect(classified.retryable).toBe(false);
	});

	it("classifies command execution failures", () => {
		const classified = classifySandboxError(
			new Error("Command failed (1): pnpm test"),
		);

		expect(classified.type).toBe("command_execution_error");
		expect(classified.retryable).toBe(false);
	});
});
