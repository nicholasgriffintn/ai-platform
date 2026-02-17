import { describe, expect, it } from "vitest";

import { SandboxCancellationError } from "../cancellation";
import { SandboxTimeoutError } from "../execution-control";
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

	it("classifies cancellation as a terminal cancelled state", () => {
		const classified = classifySandboxError(
			new SandboxCancellationError("Run cancelled by user"),
		);

		expect(classified.type).toBe("cancelled");
		expect(classified.retryable).toBe(false);
	});

	it("classifies timeout as a terminal timeout state", () => {
		const classified = classifySandboxError(
			new SandboxTimeoutError("Sandbox run timed out after 120 seconds"),
		);

		expect(classified.type).toBe("timeout");
		expect(classified.retryable).toBe(false);
	});
});
