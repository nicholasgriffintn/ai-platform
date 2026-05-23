import { describe, expect, it } from "vitest";

import {
	isStartFiberResult,
	parseSandboxDispatchFiberMessage,
	parseSandboxDispatchRecoveryMessage,
} from "../fibers";

const dispatchMessage = {
	kind: "sandbox_run_dispatch",
	runId: "run-123",
	recordId: "record-1",
	userId: 7,
	payload: {
		installationId: 1,
		repo: "owner/repo",
		task: "Task",
		shouldCommit: false,
	},
};

describe("sandbox run coordinator fibers", () => {
	it("parses direct and nested dispatch fiber messages", () => {
		expect(parseSandboxDispatchFiberMessage(dispatchMessage)).toMatchObject({
			runId: "run-123",
		});
		expect(parseSandboxDispatchFiberMessage({ message: dispatchMessage })).toMatchObject({
			runId: "run-123",
		});
		expect(parseSandboxDispatchFiberMessage({ message: { kind: "other" } })).toBeNull();
	});

	it("uses recovery metadata before snapshots", () => {
		expect(
			parseSandboxDispatchRecoveryMessage({
				id: "fiber-1",
				name: "sandbox-run-dispatch",
				metadata: { message: dispatchMessage },
				snapshot: null,
				createdAt: 1773576000000,
			}),
		).toMatchObject({
			runId: "run-123",
		});
	});

	it("validates managed fiber start results", () => {
		expect(
			isStartFiberResult({
				fiberId: "fiber-1",
				name: "sandbox-run-dispatch",
				status: "running",
				accepted: true,
				createdAt: 1773576000000,
			}),
		).toBe(true);
		expect(isStartFiberResult({ fiberId: "fiber-1", accepted: true })).toBe(false);
	});
});
