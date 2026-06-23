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
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sync-models-dev-trigger-"));
	temporaryDirectories.push(directory);
	await fs.writeFile(
		path.join(directory, "test-provider.ts"),
		`import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "test-provider";

export const testProviderModelConfig: ModelConfig = createModelConfigObject([
\tcreateModelConfig("acme-chat", PROVIDER, {
\t\tname: "Acme Chat",
\t\tmatchingModel: "acme-chat",
\t}),
]);
`,
		"utf8",
	);
	return directory;
}

function modelsDevUrl() {
	return `data:application/json,${encodeURIComponent(
		JSON.stringify({
			"test-provider": {
				models: {
					"acme-chat": {
						id: "acme-chat",
						name: "Acme Chat",
					},
				},
			},
		}),
	)}`;
}

async function createTriggerServer() {
	const requests = [];
	const server = http.createServer(async (request, response) => {
		if (request.method === "GET" && request.url?.startsWith("/models/artificial-analysis")) {
			response.writeHead(200, { "content-type": "application/json" });
			response.end(
				JSON.stringify({
					attribution: {
						label: "Artificial Analysis",
						url: "https://artificialanalysis.ai/",
					},
					models: [],
					pagination: {
						total: 0,
						page: 1,
						limit: 100,
						totalPages: 1,
					},
				}),
			);
			return;
		}

		let body = "";
		for await (const chunk of request) {
			body += chunk;
		}
		requests.push({
			method: request.method,
			url: request.url,
			authorization: request.headers.authorization,
			body: JSON.parse(body),
		});
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify({ task_id: "task-1", status: "queued" }));
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	servers.push(server);
	const address = server.address();
	return {
		requests,
		baseUrl: `http://127.0.0.1:${address.port}`,
	};
}

describe("sync-models-dev analysis trigger", () => {
	it("posts to the API after a successful write sync when configured", async () => {
		const modelsDir = await createModelsDirectory();
		const { baseUrl, requests } = await createTriggerServer();

		const { stdout } = await execFileAsync(
			"node",
			[
				SCRIPT_PATH,
				"--write",
				"--trigger-analysis-task",
				"--api-url",
				modelsDevUrl(),
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

		expect(stdout).toContain("Triggered Artificial Analysis ingestion task task-1.");
		expect(requests).toEqual([
			expect.objectContaining({
				method: "POST",
				url: "/admin/model-analysis/sync-completed",
				authorization: "Bearer ak_test",
				body: expect.objectContaining({
					source: "models.dev",
					write: true,
					stats: expect.objectContaining({
						processedFiles: 1,
						changedFiles: 0,
						unchangedFiles: 1,
						skippedFiles: 0,
					}),
				}),
			}),
		]);
	});
});
