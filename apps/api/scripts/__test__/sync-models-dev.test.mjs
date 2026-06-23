import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(TEST_DIR, "../sync-models-dev.mjs");

const temporaryDirectories = [];
const servers = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => fs.rm(directory, { recursive: true, force: true })),
	);
	await Promise.all(
		servers.splice(0).map(
			(server) =>
				new Promise((resolve, reject) => {
					server.close((error) => (error ? reject(error) : resolve()));
				}),
		),
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

async function createAnalysisServer(payload) {
	const requests = [];
	const server = http.createServer((request, response) => {
		requests.push({
			method: request.method,
			url: request.url,
			authorization: request.headers.authorization,
		});
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify(payload));
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	servers.push(server);
	const address = server.address();
	return {
		requests,
		baseUrl: `http://127.0.0.1:${address.port}`,
	};
}

describe("sync-models-dev", () => {
	it("syncs Artificial Analysis strengths and router scores into model configs", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "test-provider.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "test-provider";

export const testProviderModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("openai/gpt-5", PROVIDER, {
\t\tname: "GPT-5",
\t\tmatchingModel: "openai/gpt-5",
\t\tstrengths: ["vision"],
\t}),
]);
`,
			"utf8",
		);

		const { baseUrl, requests } = await createAnalysisServer({
			attribution: {
				label: "Artificial Analysis",
				url: "https://artificialanalysis.ai/",
			},
			models: [
				{
					id: "aa-gpt-5",
					name: "GPT-5",
					slug: "gpt-5",
					evaluations: {
						artificial_analysis_intelligence_index: 72,
						artificial_analysis_coding_index: 83,
						artificial_analysis_agentic_index: 66,
					},
					intelligence_index: 72,
					coding_index: 83,
					agentic_index: 66,
					intelligence_index_version: 4.1,
					price_1m_input_tokens: 0.25,
					price_1m_output_tokens: 1.25,
					median_output_tokens_per_second: 120,
					median_time_to_first_token_seconds: 0.8,
				},
			],
			pagination: {
				total: 1,
				page: 1,
				limit: 100,
				totalPages: 1,
			},
		});

		const { stdout } = await execFileAsync(
			"node",
			[
				SCRIPT_PATH,
				"--write",
				"--api-url",
				modelsDevUrl({
					"test-provider": {
						models: {
							"openai/gpt-5": {
								id: "openai/gpt-5",
								name: "GPT-5",
							},
						},
					},
				}),
				"--models-dir",
				modelsDir,
			],
			{
				env: {
					...process.env,
					POLYCHAT_API_BASE_URL: baseUrl,
					POLYCHAT_API_KEY: "ak_test",
				},
			},
		);
		const syncedFile = await fs.readFile(modelFile, "utf8");

		expect(stdout).toContain("Synced Artificial Analysis data for 1 models from 1 cached records.");
		expect(requests).toEqual([
			{
				method: "GET",
				url: "/models/artificial-analysis?page=1&limit=100",
				authorization: "Bearer ak_test",
			},
		]);
		expect(syncedFile).toContain(
			'strengths: ["vision", "general_knowledge", "analysis", "reasoning", "coding", "agents", "instruction"]',
		);
		expect(syncedFile).toContain("contextComplexity: 5");
		expect(syncedFile).toContain("reliability: 4");
		expect(syncedFile).toContain("speed: 4");
		expect(syncedFile).toContain("costPer1kInputTokens: 0.00025");
		expect(syncedFile).toContain("costPer1kOutputTokens: 0.00125");
		expect(syncedFile).toContain("artificialAnalysis: {");
		expect(syncedFile).toContain("intelligenceIndex: 72");
		expect(syncedFile).toContain("codingIndex: 83");
		expect(syncedFile).toContain("agenticIndex: 66");
	});

	it("derives Artificial Analysis updates from existing model capabilities", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "test-provider.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "test-provider";

export const testProviderModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("acme/pro", PROVIDER, {
\t\tname: "Acme Pro",
\t\tmatchingModel: "acme/pro",
\t\tmodalities: {
\t\t\tinput: ["text", "image", "pdf"],
\t\t\toutput: ["text"],
\t\t},
\t\tsupportsAttachments: true,
\t\tsupportsToolCalls: true,
\t\tcontextWindow: 1000000,
\t\tmaxTokens: 128000,
\t\tstrengths: ["chat"],
\t}),
]);
`,
			"utf8",
		);

		const { baseUrl } = await createAnalysisServer({
			models: [
				{
					id: "aa-acme-pro",
					name: "Acme Pro",
					slug: "acme-pro",
					evaluations: {
						artificial_analysis_intelligence_index: 20,
						artificial_analysis_coding_index: 20,
						artificial_analysis_agentic_index: 20,
					},
					intelligence_index: 20,
					coding_index: 20,
					agentic_index: 20,
					intelligence_index_version: 4.1,
					price_1m_input_tokens: 9,
					price_1m_output_tokens: 12,
					median_output_tokens_per_second: 15,
					median_time_to_first_token_seconds: 9,
				},
			],
			pagination: {
				total: 1,
				page: 1,
				limit: 100,
				totalPages: 1,
			},
		});

		await execFileAsync(
			"node",
			[
				SCRIPT_PATH,
				"--write",
				"--api-url",
				modelsDevUrl({
					"test-provider": {
						models: {
							"acme/pro": {
								id: "acme/pro",
								name: "Acme Pro",
								cost: {
									input: 1,
									output: 2,
								},
							},
						},
					},
				}),
				"--models-dir",
				modelsDir,
			],
			{
				env: {
					...process.env,
					POLYCHAT_API_BASE_URL: baseUrl,
					POLYCHAT_API_KEY: "ak_test",
				},
			},
		);
		const syncedFile = await fs.readFile(modelFile, "utf8");

		expect(syncedFile).toContain('strengths: ["chat", "vision", "document", "tool_use"]');
		expect(syncedFile).toContain("contextComplexity: 5");
		expect(syncedFile).toContain("costPer1kInputTokens: 0.001");
		expect(syncedFile).toContain("costPer1kOutputTokens: 0.002");
		expect(syncedFile).not.toContain("costPer1kInputTokens: 0.009");
		expect(syncedFile).not.toContain("costPer1kOutputTokens: 0.012");
	});

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
						tags: ["current"],
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

	it("does not add dated snapshots when a current alias represents the family", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "test-provider.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "test-provider";

export const testProviderModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("acme-chat", PROVIDER, {
\t\tname: "Acme Chat",
\t\tmatchingModel: "acme-chat-0",
\t}),
]);
`,
			"utf8",
		);

		const apiUrl = modelsDevUrl({
			"test-provider": {
				models: {
					"acme-chat-0": {
						id: "acme-chat-0",
						name: "Acme Chat (latest)",
						release_date: "2025-05-22",
					},
					"acme-chat-20250514": {
						id: "acme-chat-20250514",
						name: "Acme Chat",
						release_date: "2025-05-22",
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

		expect(stdout).toContain("Added new models: 0.");
		expect(syncedFile).toContain('matchingModel: "acme-chat-0"');
		expect(syncedFile).not.toContain("acme-chat-20250514");
	});

	it("keeps local current aliases when the remote family has concrete members", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "test-provider.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "test-provider";

export const testProviderModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("acme-chat-latest", PROVIDER, {
\t\tname: "Old Alias",
\t\tmatchingModel: "acme-chat-latest",
\t}),

\tcreateModelConfig("acme-chat-2507", PROVIDER, {
\t\tname: "Current",
\t\tmatchingModel: "acme-chat-2507",
\t}),
]);
`,
			"utf8",
		);

		const apiUrl = modelsDevUrl({
			"test-provider": {
				models: {
					"acme-chat-2505": {
						id: "acme-chat-2505",
						release_date: "2025-05-07",
					},
					"acme-chat-2507": {
						id: "acme-chat-2507",
						release_date: "2025-07-10",
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

		expect(stdout).toContain("Added new models: 0.");
		expect(syncedFile).toContain("acme-chat-latest");
		expect(syncedFile).toContain('createModelConfig("acme-chat-2507"');
	});

	it("keeps local Anthropic current aliases that use a different model ID word order", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "anthropic.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "anthropic";

export const anthropicModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("claude-4.5-haiku", PROVIDER, {
\t\tname: "Claude 4.5 Haiku",
\t\tmatchingModel: "claude-4-5-haiku-latest",
\t}),

\tcreateModelConfig("claude-haiku-4-5", PROVIDER, {
\t\tname: "Claude Haiku 4.5",
\t\tmatchingModel: "claude-haiku-4-5",
\t}),
]);
`,
			"utf8",
		);

		const apiUrl = modelsDevUrl({
			anthropic: {
				models: {
					"claude-haiku-4-5": {
						id: "claude-haiku-4-5",
						name: "Claude Haiku 4.5 (latest)",
						release_date: "2025-10-15",
					},
					"claude-haiku-4-5-20251001": {
						id: "claude-haiku-4-5-20251001",
						name: "Claude Haiku 4.5",
						release_date: "2025-10-15",
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

		expect(stdout).toContain("Added new models: 0.");
		expect(syncedFile).toContain("claude-4-5-haiku-latest");
		expect(syncedFile).toContain('createModelConfig("claude-haiku-4-5"');
	});

	it("keeps a Mistral latest alias ahead of a concrete current Devstral version", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "mistral.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "mistral";

export const mistralModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("devstral-latest", PROVIDER, {
\t\tname: "Devstral",
\t\tmatchingModel: "devstral-latest",
\t}),

]);
`,
			"utf8",
		);

		const apiUrl = modelsDevUrl({
			mistral: {
				models: {
					"devstral-2": {
						id: "devstral-2",
						tags: ["current"],
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

		expect(stdout).toContain("Added new models: 0.");
		expect(syncedFile).toContain('createModelConfig("devstral-latest"');
		expect(syncedFile).not.toContain('createModelConfig("devstral-2"');
	});

	it("does not reintroduce Mistral Nemo under the old remote id", async () => {
		const modelsDir = await createModelsDirectory();
		const modelFile = path.join(modelsDir, "mistral.ts");
		await fs.writeFile(
			modelFile,
			`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "mistral";

export const mistralModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("open-mistral-nemo", PROVIDER, {
\t\tname: "Mistral Nemo",
\t\tmatchingModel: "open-mistral-nemo",
\t}),
]);
`,
			"utf8",
		);

		const apiUrl = modelsDevUrl({
			mistral: {
				models: {
					"mistral-nemo": {
						id: "mistral-nemo",
						name: "Mistral Nemo",
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

		expect(stdout).toContain("Added new models: 0.");
		expect(syncedFile).toContain('createModelConfig("open-mistral-nemo"');
		expect(syncedFile).not.toContain('createModelConfig("mistral-nemo"');
	});
});
