import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
	assessModelSyncDiff,
	buildPolychatRequestBody,
	validatePolychatReviewResponse,
} from "../review-model-sync.mjs";

const execFileAsync = promisify(execFile);
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(TEST_DIR, "../review-model-sync.mjs");
const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => fs.rm(directory, { recursive: true, force: true })),
	);
});

describe("review-model-sync", () => {
	it("assesses model diffs when invoked from the api package directory", async () => {
		const repository = await fs.mkdtemp(path.join(os.tmpdir(), "review-model-sync-"));
		temporaryDirectories.push(repository);
		const apiDirectory = path.join(repository, "apps/api");
		const modelFile = path.join(apiDirectory, "src/data-model/models/openai.ts");
		await fs.mkdir(path.dirname(modelFile), { recursive: true });
		await fs.writeFile(
			modelFile,
			`export const openaiModelConfig = {
};
`,
			"utf8",
		);
		await execFileAsync("git", ["init"], { cwd: repository });
		await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: repository });
		await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: repository });
		await execFileAsync("git", ["add", "apps/api/src/data-model/models/openai.ts"], {
			cwd: repository,
		});
		await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repository });
		await fs.writeFile(
			modelFile,
			`export const openaiModelConfig = {
\t"gpt-6-mini": {
\t\tname: "GPT-6 Mini",
\t},
};
`,
			"utf8",
		);
		await execFileAsync("git", ["add", "apps/api/src/data-model/models/openai.ts"], {
			cwd: repository,
		});
		await execFileAsync("git", ["commit", "-m", "sync models"], { cwd: repository });

		const { stdout } = await execFileAsync(
			"node",
			[SCRIPT_PATH, "assess", "--base", "HEAD^", "--head", "HEAD"],
			{ cwd: apiDirectory },
		);
		const assessment = JSON.parse(stdout);

		expect(assessment).toMatchObject({
			shouldCallPolychat: true,
			changedFiles: ["apps/api/src/data-model/models/openai.ts"],
		});
		expect(assessment.reasons).toContain("object_model_entries_changed");
	});

	it("skips Polychat when the sync only changes low-value catalogue metadata", () => {
		const assessment = assessModelSyncDiff({
			changedFiles: ["apps/api/src/data-model/models/openai.ts"],
			diff: `diff --git a/apps/api/src/data-model/models/openai.ts b/apps/api/src/data-model/models/openai.ts
@@
-\t\tlastUpdated: "June 1, 2026",
+\t\tlastUpdated: "June 2, 2026",
`,
		});

		expect(assessment.shouldCallPolychat).toBe(false);
		expect(assessment.reasons).toEqual([]);
	});

	it("calls Polychat when the sync adds or removes model entries", () => {
		const assessment = assessModelSyncDiff({
			changedFiles: ["apps/api/src/data-model/models/openai.ts"],
			diff: `diff --git a/apps/api/src/data-model/models/openai.ts b/apps/api/src/data-model/models/openai.ts
@@
+\tcreateModelConfig("gpt-6-mini", PROVIDER, {
+\t\tname: "GPT-6 Mini",
+\t\tmatchingModel: "gpt-6-mini",
+\t}),
`,
		});

		expect(assessment.shouldCallPolychat).toBe(true);
		expect(assessment.reasons).toContain("model_entries_changed");
	});

	it("calls Polychat when router scoring metadata changes", () => {
		const assessment = assessModelSyncDiff({
			changedFiles: ["apps/api/src/data-model/models/deepseek.ts"],
			diff: `diff --git a/apps/api/src/data-model/models/deepseek.ts b/apps/api/src/data-model/models/deepseek.ts
@@
-\t\tincludedInRouter: false,
+\t\tincludedInRouter: true,
`,
		});

		expect(assessment.shouldCallPolychat).toBe(true);
		expect(assessment.reasons).toContain("router_metadata_changed");
	});

	it("rejects Polychat patches outside the allowed router/model surface", () => {
		expect(() =>
			validatePolychatReviewResponse({
				shouldApply: true,
				summary: "Unsafe workflow edit",
				unifiedDiff: `diff --git a/.github/workflows/sync-models-dev.yml b/.github/workflows/sync-models-dev.yml
--- a/.github/workflows/sync-models-dev.yml
+++ b/.github/workflows/sync-models-dev.yml
@@
-permissions:
+permissions:
`,
				decisions: [],
				risks: [],
			}),
		).toThrow(/not allowed/);
	});

	it("builds a strict structured-output Polychat request", () => {
		const body = buildPolychatRequestBody({
			model: "gpt-5.4",
			diff: "diff --git a/apps/api/src/data-model/models/openai.ts b/apps/api/src/data-model/models/openai.ts",
			assessment: {
				shouldCallPolychat: true,
				reasons: ["model_entries_changed"],
				changedFiles: ["apps/api/src/data-model/models/openai.ts"],
			},
		});

		expect(body.stream).toBe(false);
		expect(body.response_format?.json_schema?.strict).toBe(true);
		expect(body.response_format?.json_schema?.schema.required).toContain("unifiedDiff");
		expect(body.messages.at(-1)?.content).toContain("model_entries_changed");
	});
});
