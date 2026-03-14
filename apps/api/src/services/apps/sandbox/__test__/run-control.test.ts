import { describe, expect, it } from "vitest";

import {
	abortActiveSandboxRun,
	cancelActiveSandboxRun,
	getSandboxRunAbortReason,
	registerActiveSandboxRun,
} from "../run-control";

describe("run-control", () => {
	it("aborts active run controllers", () => {
		const controller = new AbortController();
		const unregister = registerActiveSandboxRun("run-123", controller);

		const cancelled = cancelActiveSandboxRun("run-123");

		expect(cancelled).toBe(true);
		expect(controller.signal.aborted).toBe(true);
		expect(getSandboxRunAbortReason(controller.signal)).toEqual({
			type: "cancelled",
			message: "Run cancelled by user",
		});
		unregister();
	});

	it("cleans up stale registrations", () => {
		const controller = new AbortController();
		const unregister = registerActiveSandboxRun("run-456", controller);
		unregister();

		expect(cancelActiveSandboxRun("run-456")).toBe(false);
	});

	it("only unregisters the matching registration", () => {
		const first = new AbortController();
		const unregisterFirst = registerActiveSandboxRun("run-789", first);

		const second = new AbortController();
		const unregisterSecond = registerActiveSandboxRun("run-789", second);

		unregisterFirst();
		expect(cancelActiveSandboxRun("run-789")).toBe(true);
		expect(second.signal.aborted).toBe(true);
		expect(first.signal.aborted).toBe(false);
		unregisterSecond();
	});

	it("records timeout abort metadata", () => {
		const controller = new AbortController();
		registerActiveSandboxRun("run-timeout", controller);

		const aborted = abortActiveSandboxRun("run-timeout", {
			type: "timeout",
			message: "Sandbox run timed out after 45 seconds",
		});

		expect(aborted).toBe(true);
		expect(getSandboxRunAbortReason(controller.signal)).toEqual({
			type: "timeout",
			message: "Sandbox run timed out after 45 seconds",
		});
	});
});
