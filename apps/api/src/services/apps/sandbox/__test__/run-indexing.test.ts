import { beforeEach, describe, expect, it, vi } from "vitest";

import { indexSandboxRunResult } from "../run-indexing";
import { getEmbeddingProvider } from "~/lib/providers/capabilities/embedding/helpers";

vi.mock("~/lib/providers/capabilities/embedding/helpers", () => ({
	getEmbeddingProvider: vi.fn(),
}));

describe("run indexing", () => {
	const generate = vi.fn();
	const insert = vi.fn();
	const getUserById = vi.fn();
	const getUserSettings = vi.fn();

	const context = {
		env: {
			AI: {},
			VECTOR_DB: {},
		},
		repositories: {
			users: { getUserById },
			userSettings: { getUserSettings },
		},
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
		getUserById.mockResolvedValue({
			id: 7,
			email: "dev@example.com",
			name: "Dev",
		});
		getUserSettings.mockResolvedValue({});
		generate.mockResolvedValue([
			{ id: "sandbox-run-run-1", values: [1, 2, 3] },
		]);
		insert.mockResolvedValue({ status: "success" });
		vi.mocked(getEmbeddingProvider).mockReturnValue({
			generate,
			insert,
		} as any);
	});

	it("indexes completed runs into user-scoped namespace", async () => {
		await indexSandboxRunResult({
			serviceContext: context,
			userId: 7,
			run: {
				runId: "run-1",
				installationId: 99,
				repo: "owner/repo",
				task: "Implement feature",
				model: "mistral-large",
				shouldCommit: true,
				status: "completed",
				startedAt: "2026-03-15T12:00:00.000Z",
				updatedAt: "2026-03-15T12:00:01.000Z",
				completedAt: "2026-03-15T12:00:01.000Z",
				result: {
					summary: "Done",
					diff: "diff --git",
				},
			} as any,
		});

		expect(generate).toHaveBeenCalledWith(
			"sandbox_run",
			expect.stringContaining("Repository: owner/repo"),
			"sandbox-run-run-1",
			expect.objectContaining({
				runId: "run-1",
			}),
		);
		expect(insert).toHaveBeenCalledWith(expect.any(Array), {
			namespace: "sandbox_runs_user_7",
			topK: 10,
			returnMetadata: "none",
		});
	});

	it("skips indexing for non-terminal run states", async () => {
		await indexSandboxRunResult({
			serviceContext: context,
			userId: 7,
			run: {
				runId: "run-2",
				installationId: 99,
				repo: "owner/repo",
				task: "Implement feature",
				model: "mistral-large",
				shouldCommit: true,
				status: "running",
				startedAt: "2026-03-15T12:00:00.000Z",
				updatedAt: "2026-03-15T12:00:01.000Z",
			} as any,
		});

		expect(generate).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});
});
