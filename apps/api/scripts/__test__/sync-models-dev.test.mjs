import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(TEST_DIR, "../sync-models-dev.mjs");

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => fs.rm(directory, { recursive: true, force: true })),
	);
});

async function createModelsDirectory() {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sync-models-dev-"));
	temporaryDirectories.push(directory);
	return directory;
}

function modelsDevUrl(payload) {
	return `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`;
}

describe("sync-models-dev", () => {
	it("keeps every latest-tagged family member when writing synced configs", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "test-provider.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "test-provider";

export const testProviderModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("acme-chat-2025-01-01", PROVIDER, {
\t\tname: "Stable",
\t\tmatchingModel: "acme-chat-2025-01-01",
\t}),

\tcreateModelConfig("acme-chat-2025-02-01", PROVIDER, {
\t\tname: "Preview",
\t\tmatchingModel: "acme-chat-2025-02-01",
\t}),

\tcreateModelConfig("acme-chat-2024-12-01", PROVIDER, {
\t\tname: "Old",
\t\tmatchingModel: "acme-chat-2024-12-01",
\t}),
]);
`,
			"utf8",
		);

		const apiUrl = modelsDevUrl({
			"test-provider": {
				models: {
					"acme-chat-2025-01-01": {
						id: "acme-chat-2025-01-01",
						latest: true,
					},
					"acme-chat-2025-02-01": {
						id: "acme-chat-2025-02-01",
						tags: ["stable"],
					},
					"acme-chat-2024-12-01": {
						id: "acme-chat-2024-12-01",
					},
				},
			},
		});

		const { stdout } = await execFileAsync("node", [
			SCRIPT_PATH,
			"--write",
			"--api-url",
			apiUrl,
			"--models-dir",
			modelsDir,
		]);
		const syncedFile = await fs.readFile(modelFile, "utf8");

		expect(stdout).toContain("Processed 1 files (1 changed, 0 unchanged, 0 skipped).");
		expect(stdout).toContain("Removed deprecated models: 1.");
		expect(syncedFile).toContain('createModelConfig("acme-chat-2025-01-01"');
		expect(syncedFile).toContain('createModelConfig("acme-chat-2025-02-01"');
		expect(syncedFile).not.toContain('createModelConfig("acme-chat-2024-12-01"');
	});

	it("removes duplicate entries that resolve to the same remote model", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "test-provider.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "test-provider";

export const testProviderModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("acme-chat-old-alias", PROVIDER, {
\t\tname: "Old Alias",
\t\tmatchingModel: "acme-chat-2025-01-01",
\t}),

\tcreateModelConfig("acme-chat-2025-01-01", PROVIDER, {
\t\tname: "Canonical",
\t\tmatchingModel: "acme-chat-2025-01-01",
\t}),
]);
`,
			"utf8",
		);

		const apiUrl = modelsDevUrl({
			"test-provider": {
				models: {},
			},
		});

		const { stdout } = await execFileAsync("node", [
			SCRIPT_PATH,
			"--write",
			"--api-url",
			apiUrl,
			"--models-dir",
			modelsDir,
		]);
		const syncedFile = await fs.readFile(modelFile, "utf8");

		expect(stdout).toContain("Removed duplicate models: 1.");
		expect(syncedFile).toContain('createModelConfig("acme-chat-2025-01-01"');
		expect(syncedFile).not.toContain('createModelConfig("acme-chat-old-alias"');
	});

	it("removes older remote family versions without removing unrelated models", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "test-provider.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "test-provider";

export const testProviderModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("acme-chat-2025-01-01", PROVIDER, {
\t\tname: "January",
\t\tmatchingModel: "acme-chat-2025-01-01",
\t}),

\tcreateModelConfig("acme-chat-2025-02-01", PROVIDER, {
\t\tname: "February",
\t\tmatchingModel: "acme-chat-2025-02-01",
\t}),

\tcreateModelConfig("solo-model", PROVIDER, {
\t\tname: "Solo",
\t\tmatchingModel: "solo-model",
\t}),
]);
`,
			"utf8",
		);

		const apiUrl = modelsDevUrl({
			"test-provider": {
				models: {
					"acme-chat-2025-01-01": {
						id: "acme-chat-2025-01-01",
						release_date: "2025-01-01",
					},
					"acme-chat-2025-02-01": {
						id: "acme-chat-2025-02-01",
						release_date: "2025-02-01",
					},
					"solo-model": {
						id: "solo-model",
					},
				},
			},
		});

		const { stdout } = await execFileAsync("node", [
			SCRIPT_PATH,
			"--write",
			"--api-url",
			apiUrl,
			"--models-dir",
			modelsDir,
		]);
		const syncedFile = await fs.readFile(modelFile, "utf8");

		expect(stdout).toContain("Removed deprecated models: 1.");
		expect(syncedFile).not.toContain('createModelConfig("acme-chat-2025-01-01"');
		expect(syncedFile).toContain('createModelConfig("acme-chat-2025-02-01"');
		expect(syncedFile).toContain('createModelConfig("solo-model"');
	});
});
