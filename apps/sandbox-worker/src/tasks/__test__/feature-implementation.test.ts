import { describe, expect, it, vi } from "vitest";

import { pushBranchToRemote } from "../../lib/push-branch";

describe("pushBranchToRemote", () => {
	it("pushes branch using auth header when provided", async () => {
		const exec = vi.fn().mockResolvedValue({
			success: true,
			exitCode: 0,
			stdout: "",
			stderr: "",
		});
		const checkpoint = vi.fn().mockResolvedValue(undefined);
		const emitted: Array<Record<string, unknown>> = [];
		const logs: string[] = [];

		await pushBranchToRemote({
			sandbox: {
				exec,
			} as any,
			repoTargetDir: "/workspace/repo",
			branchName: "polychat/feature-123",
			checkoutAuthHeader: "AUTHORIZATION: basic token",
			executionLogs: logs,
			checkpoint,
			emit: async (event) => {
				emitted.push(event as Record<string, unknown>);
			},
		});

		expect(exec).toHaveBeenCalledTimes(1);
		expect(exec.mock.calls[0]?.[0]).toContain("http.extraHeader=");
		expect(exec.mock.calls[0]?.[0]).toContain(
			"push --set-upstream origin 'polychat/feature-123'",
		);
		expect(checkpoint).toHaveBeenCalledTimes(2);
		expect(emitted.map((event) => event.type)).toEqual([
			"commit_push_started",
			"commit_pushed",
		]);
		expect(logs.length).toBe(1);
		expect(logs[0]).toContain("[auth header redacted]");
	});

	it("pushes branch without auth header when none is provided", async () => {
		const exec = vi.fn().mockResolvedValue({
			success: true,
			exitCode: 0,
			stdout: "",
			stderr: "",
		});
		const emitted: Array<Record<string, unknown>> = [];

		await pushBranchToRemote({
			sandbox: {
				exec,
			} as any,
			repoTargetDir: "/workspace/repo",
			branchName: "polychat/feature-456",
			executionLogs: [],
			checkpoint: vi.fn().mockResolvedValue(undefined),
			emit: async (event) => {
				emitted.push(event as Record<string, unknown>);
			},
		});

		expect(exec).toHaveBeenCalledTimes(1);
		expect(exec.mock.calls[0]?.[0]).not.toContain("http.extraHeader=");
		expect(exec.mock.calls[0]?.[0]).toContain(
			"push --set-upstream origin 'polychat/feature-456'",
		);
		expect(emitted.map((event) => event.type)).toEqual([
			"commit_push_started",
			"commit_pushed",
		]);
	});

	it("throws when push fails", async () => {
		const exec = vi.fn().mockResolvedValue({
			success: false,
			exitCode: 1,
			stdout: "",
			stderr: "permission denied",
		});
		const emitted: Array<Record<string, unknown>> = [];

		await expect(
			pushBranchToRemote({
				sandbox: {
					exec,
				} as any,
				repoTargetDir: "/workspace/repo",
				branchName: "polychat/feature-789",
				executionLogs: [],
				checkpoint: vi.fn().mockResolvedValue(undefined),
				emit: async (event) => {
					emitted.push(event as Record<string, unknown>);
				},
			}),
		).rejects.toThrow("permission denied");

		expect(emitted.map((event) => event.type)).toEqual(["commit_push_started"]);
	});
});
