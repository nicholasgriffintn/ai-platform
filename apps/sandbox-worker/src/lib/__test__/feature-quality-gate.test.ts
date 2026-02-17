import { describe, expect, it, vi } from "vitest";

import {
	deriveQualityGateCommands,
	runQualityGate,
} from "../feature-implementation/quality-gate";
import type { SandboxExecInstance } from "../feature-implementation/types";

function buildExecResult(params: {
	command: string;
	success: boolean;
	exitCode: number;
	stdout?: string;
	stderr?: string;
}) {
	return {
		success: params.success,
		exitCode: params.exitCode,
		stdout: params.stdout ?? "",
		stderr: params.stderr ?? "",
		command: params.command,
		duration: 1,
		timestamp: new Date().toISOString(),
	};
}

describe("quality gate helpers", () => {
	it("derives only safe validation commands from plans", () => {
		const commands = deriveQualityGateCommands({
			plans: [
				[
					"Validation commands:",
					"```bash",
					"pnpm lint",
					"pnpm typecheck",
					"pnpm install",
					"git add .",
					"pnpm test && pnpm lint",
					"pnpm lint",
					"```",
				].join("\n"),
			],
		});

		expect(commands).toEqual(["pnpm lint", "pnpm typecheck"]);
	});

	it("runs all derived checks and reports success", async () => {
		const execMock: SandboxExecInstance["exec"] = vi
			.fn()
			.mockResolvedValueOnce(
				buildExecResult({
					command: "pnpm lint",
					success: true,
					exitCode: 0,
					stdout: "lint ok",
				}),
			)
			.mockResolvedValueOnce(
				buildExecResult({
					command: "pnpm typecheck",
					success: true,
					exitCode: 0,
					stdout: "typecheck ok",
				}),
			);
		const sandbox: SandboxExecInstance = {
			exec: execMock,
		};
		const emitted: Array<{ type: string }> = [];
		const logs: string[] = [];

		const result = await runQualityGate({
			sandbox,
			repoTargetDir: "repo",
			commands: ["pnpm lint", "pnpm typecheck"],
			executionLogs: logs,
			emit: async (event) => {
				emitted.push(event);
			},
		});

		expect(result.passed).toBe(true);
		expect(result.checks).toHaveLength(2);
		expect(logs).toHaveLength(2);
		expect(
			emitted.some((event) => event.type === "quality_gate_completed"),
		).toBe(true);
	});

	it("reports failing checks without throwing", async () => {
		const execMock: SandboxExecInstance["exec"] = vi.fn().mockResolvedValue(
			buildExecResult({
				command: "pnpm test",
				success: false,
				exitCode: 1,
				stderr: "failing test",
			}),
		);
		const sandbox: SandboxExecInstance = {
			exec: execMock,
		};

		const result = await runQualityGate({
			sandbox,
			repoTargetDir: "repo",
			commands: ["pnpm test"],
			executionLogs: [],
			emit: async () => undefined,
		});

		expect(result.passed).toBe(false);
		expect(result.checks[0]?.passed).toBe(false);
		expect(result.summary).toContain("failed");
	});
});
