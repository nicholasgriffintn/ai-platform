import { describe, expect, it, vi } from "vitest";

import { assertSafeCommand, buildSummary, runSandboxCommand } from "../commands";

describe("assertSafeCommand", () => {
	it("allows non-mutating commands in read-only mode", () => {
		expect(() => assertSafeCommand("pnpm test --filter api", { readOnly: true })).not.toThrow();
	});

	it("blocks mutating commands in read-only mode", () => {
		expect(() => assertSafeCommand("git add -A", { readOnly: true })).toThrow(/read-only/);
	});

	it("blocks shell redirection in read-only mode", () => {
		expect(() => assertSafeCommand("echo hi > /tmp/test.txt", { readOnly: true })).toThrow(
			/read-only/,
		);
	});

	it("blocks interpreter commands in read-only mode", () => {
		expect(() =>
			assertSafeCommand("python -c \"open('tmp.txt','w').write('x')\"", {
				readOnly: true,
			}),
		).toThrow(/not allowed|read-only/);
	});
});

describe("runSandboxCommand", () => {
	function createSseStream(events: Array<Record<string, unknown>>): ReadableStream<Uint8Array> {
		const encoder = new TextEncoder();
		return new ReadableStream<Uint8Array>({
			start(controller) {
				for (const event of events) {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
				}
				controller.close();
			},
		});
	}

	it("collects streamed command output and returns the completion result", async () => {
		const exec = vi.fn();
		const execStream = vi.fn().mockResolvedValue(
			createSseStream([
				{ type: "stdout", data: "building\n", timestamp: "2026-05-18T00:00:00.000Z" },
				{ type: "stderr", data: "warning\n", timestamp: "2026-05-18T00:00:01.000Z" },
				{
					type: "complete",
					exitCode: 0,
					result: {
						success: true,
						exitCode: 0,
						stdout: "building\n",
						stderr: "warning\n",
						command: "pnpm build",
						duration: 12,
						timestamp: "2026-05-18T00:00:00.000Z",
					},
					timestamp: "2026-05-18T00:00:02.000Z",
				},
			]),
		);
		const output: Array<{ stream: "stdout" | "stderr"; data: string }> = [];

		const result = await runSandboxCommand(
			{
				exec,
				execStream,
			},
			"pnpm build",
			{
				onOutput: (chunk) => {
					output.push(chunk);
				},
			},
		);

		expect(exec).not.toHaveBeenCalled();
		expect(execStream).toHaveBeenCalledWith("pnpm build", { signal: undefined });
		expect(output).toEqual([
			{ stream: "stdout", data: "building\n" },
			{ stream: "stderr", data: "warning\n" },
		]);
		expect(result).toMatchObject({
			success: true,
			exitCode: 0,
			stdout: "building\n",
			stderr: "warning\n",
		});
	});

	it("falls back to buffered exec for sandbox test doubles without execStream", async () => {
		const exec = vi.fn().mockResolvedValue({
			success: true,
			exitCode: 0,
			stdout: "ok",
			stderr: "",
		});

		const result = await runSandboxCommand({ exec }, "pwd");

		expect(exec).toHaveBeenCalledWith("pwd");
		expect(result.stdout).toBe("ok");
	});
});

describe("buildSummary", () => {
	it("uses task-type specific summary text", () => {
		const summary = buildSummary(
			"Review authentication flow",
			"owner/repo",
			3,
			undefined,
			"code-review",
		);

		expect(summary).toContain("Completed code review");
	});

	it("includes refactoring summary variants", () => {
		const summary = buildSummary(
			"Cleanup duplicated parsing",
			"owner/repo",
			4,
			"sandbox/refactor-branch",
			"refactoring",
		);

		expect(summary).toContain("Completed refactoring");
		expect(summary).toContain("sandbox/refactor-branch");
	});
});
