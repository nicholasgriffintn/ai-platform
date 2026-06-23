#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import process from "node:process";

const DEFAULT_API_URL = "https://api.polychat.app/v1/chat/completions";
const DEFAULT_MODEL = "@cf/openai/gpt-oss-120b";

const MODEL_CONFIG_PREFIX = "apps/api/src/data-model/models/";
const ALLOWED_PATCH_PREFIXES = [MODEL_CONFIG_PREFIX, "apps/api/src/lib/modelRouter/"];
const ALLOWED_PATCH_FILES = new Set([
	"apps/api/src/lib/providers/models/index.ts",
	"apps/api/src/lib/__test__/models.test.ts",
]);

const ROUTER_METADATA_FIELDS = [
	"includedInRouter",
	"deprecated",
	"strengths",
	"contextComplexity",
	"reliability",
	"speed",
	"costPer1kInputTokens",
	"costPer1kOutputTokens",
	"costPer1kReasoningTokens",
	"supportsToolCalls",
	"supportsResponseFormat",
	"supportsAttachments",
	"supportsDocuments",
	"supportsSearchGrounding",
	"supportsCodeExecution",
	"modalities",
	"contextWindow",
	"maxTokens",
	"reasoningConfig",
];

const REVIEW_RESPONSE_SCHEMA = {
	type: "object",
	properties: {
		shouldApply: { type: "boolean" },
		summary: { type: "string" },
		unifiedDiff: { type: "string" },
		decisions: {
			type: "array",
			items: {
				type: "object",
				properties: {
					provider: { type: "string" },
					model: { type: "string" },
					action: { type: "string" },
					reason: { type: "string" },
				},
				required: ["provider", "model", "action", "reason"],
				additionalProperties: false,
			},
		},
		risks: { type: "array", items: { type: "string" } },
	},
	required: ["shouldApply", "summary", "unifiedDiff", "decisions", "risks"],
	additionalProperties: false,
};

let cachedGitRoot;

function resolveGitRoot() {
	if (cachedGitRoot) {
		return cachedGitRoot;
	}

	const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(result.stderr || "git rev-parse --show-toplevel failed");
	}

	cachedGitRoot = result.stdout.trim();
	return cachedGitRoot;
}

function runGit(args, options = {}) {
	const result = spawnSync("git", args, {
		cwd: resolveGitRoot(),
		encoding: "utf8",
		input: options.input,
	});
	if (result.status !== 0) {
		throw new Error(result.stderr || `git ${args.join(" ")} failed`);
	}
	return result.stdout;
}

function unique(values) {
	return [...new Set(values)];
}

function changedDiffLines(diff) {
	return diff
		.split("\n")
		.filter((line) => /^[+-]/.test(line) && !line.startsWith("+++") && !line.startsWith("---"));
}

export function assessModelSyncDiff({ changedFiles, diff }) {
	const modelFiles = changedFiles.filter((file) => file.startsWith(MODEL_CONFIG_PREFIX));
	const reasons = [];
	if (modelFiles.length === 0 || !diff.trim()) {
		return { shouldCallPolychat: false, reasons, changedFiles: modelFiles };
	}

	const lines = changedDiffLines(diff);
	if (lines.some((line) => line.includes("createModelConfig("))) {
		reasons.push("model_entries_changed");
	}
	if (lines.some((line) => ROUTER_METADATA_FIELDS.some((field) => line.includes(`${field}:`)))) {
		reasons.push("router_metadata_changed");
	}
	if (lines.some((line) => /^\s*[+-]\s*["'][^"']+["']:\s*\{/.test(line))) {
		reasons.push("object_model_entries_changed");
	}

	const nextReasons = unique(reasons);
	return {
		shouldCallPolychat: nextReasons.length > 0,
		reasons: nextReasons,
		changedFiles: modelFiles,
	};
}

function isAllowedPatchPath(filePath) {
	return (
		ALLOWED_PATCH_FILES.has(filePath) ||
		ALLOWED_PATCH_PREFIXES.some((prefix) => filePath.startsWith(prefix))
	);
}

function extractPatchPaths(unifiedDiff) {
	const paths = [];
	for (const line of unifiedDiff.split("\n")) {
		const diffMatch = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
		if (diffMatch) {
			paths.push(diffMatch[1], diffMatch[2]);
			continue;
		}
		const fileMatch = /^(?:---|\+\+\+) (?:a|b)\/(.+)$/.exec(line);
		if (fileMatch) {
			paths.push(fileMatch[1]);
		}
	}
	return unique(paths);
}

export function validatePolychatReviewResponse(response) {
	if (!response || typeof response !== "object" || Array.isArray(response)) {
		throw new Error("Polychat response must be an object");
	}
	if (typeof response.shouldApply !== "boolean") {
		throw new Error("Polychat response missing shouldApply boolean");
	}
	if (typeof response.summary !== "string") {
		throw new Error("Polychat response missing summary string");
	}
	if (!Array.isArray(response.decisions) || !Array.isArray(response.risks)) {
		throw new Error("Polychat response missing decisions or risks arrays");
	}
	const unifiedDiff = typeof response.unifiedDiff === "string" ? response.unifiedDiff : "";
	if (!response.shouldApply) {
		return { ...response, unifiedDiff: "" };
	}
	if (!unifiedDiff.trim()) {
		throw new Error("Polychat response requested apply without a unifiedDiff");
	}
	const paths = extractPatchPaths(unifiedDiff);
	if (paths.length === 0) {
		throw new Error("Polychat response unifiedDiff does not contain file paths");
	}
	for (const filePath of paths) {
		if (!isAllowedPatchPath(filePath)) {
			throw new Error(`Polychat patch path is not allowed: ${filePath}`);
		}
	}
	return response;
}

export function buildPolychatRequestBody({ model = DEFAULT_MODEL, diff, assessment }) {
	return {
		model,
		stream: false,
		store: false,
		response_format: {
			type: "json_schema",
			json_schema: {
				name: "model_sync_router_review",
				strict: true,
				schema: REVIEW_RESPONSE_SCHEMA,
			},
		},
		messages: [
			{
				role: "system",
				content:
					"You review Polychat model sync diffs. Return strict JSON only. Recommend a unified diff only when router metadata should change. Preserve generated catalogue changes, remove stale router candidates, add scoring for stable production models, and avoid expensive deprecated models winning automatic routing.",
			},
			{
				role: "user",
				content: JSON.stringify(
					{
						assessment,
						allowedPatchPaths: [...ALLOWED_PATCH_PREFIXES, ...ALLOWED_PATCH_FILES],
						validationRunByWorkflow: [
							"router/model vitest suite",
							"pnpm --filter @assistant/api typecheck",
							"pnpm --filter @assistant/api check",
						],
						diff,
					},
					null,
					2,
				),
			},
		],
	};
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function appendGithubOutput(values) {
	const outputPath = process.env.GITHUB_OUTPUT;
	if (!outputPath) {
		return;
	}
	const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
	await fs.appendFile(outputPath, `${lines.join("\n")}\n`, "utf8");
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function commandAssess(args) {
	const base = valueAfter(args, "--base") ?? "HEAD^";
	const head = valueAfter(args, "--head") ?? "HEAD";
	const assessmentOutput = valueAfter(args, "--assessment-output");
	const diffOutput = valueAfter(args, "--diff-output");
	const githubOutput = args.includes("--github-output");
	const changedFiles = runGit(["diff", "--name-only", base, head, "--", MODEL_CONFIG_PREFIX])
		.split("\n")
		.filter(Boolean);
	const diff = runGit(["diff", "--unified=80", base, head, "--", MODEL_CONFIG_PREFIX]);
	const assessment = assessModelSyncDiff({ changedFiles, diff });
	if (assessmentOutput) {
		await writeJson(assessmentOutput, assessment);
	}
	if (diffOutput) {
		await fs.writeFile(diffOutput, diff, "utf8");
	}
	if (githubOutput) {
		await appendGithubOutput({
			should_call_polychat: String(assessment.shouldCallPolychat),
			reasons: assessment.reasons.join(","),
		});
	}
	console.log(JSON.stringify(assessment, null, 2));
}

async function commandCall(args) {
	const assessmentPath = requiredValueAfter(args, "--assessment");
	const diffPath = requiredValueAfter(args, "--diff");
	const responseOutput = requiredValueAfter(args, "--response-output");
	const apiKey = process.env.POLYCHAT_API_KEY;
	if (!apiKey) {
		throw new Error("POLYCHAT_API_KEY is required");
	}
	const assessment = await readJson(assessmentPath);
	const diff = await fs.readFile(diffPath, "utf8");
	const body = buildPolychatRequestBody({
		model: process.env.POLYCHAT_MODEL_SYNC_MODEL ?? DEFAULT_MODEL,
		diff,
		assessment,
	});
	const response = await fetch(process.env.POLYCHAT_API_URL ?? DEFAULT_API_URL, {
		method: "POST",
		headers: {
			authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		throw new Error(`Polychat review request failed: ${response.status}`);
	}
	const payload = await response.json();
	const content = payload?.choices?.[0]?.message?.content;
	const parsed = typeof content === "string" ? JSON.parse(content) : content;
	const validated = validatePolychatReviewResponse(parsed);
	await writeJson(responseOutput, validated);
	console.log(JSON.stringify({ shouldApply: validated.shouldApply, summary: validated.summary }));
}

async function commandApply(args) {
	const responsePath = requiredValueAfter(args, "--response");
	const response = validatePolychatReviewResponse(await readJson(responsePath));
	if (!response.shouldApply) {
		console.log("Polychat did not recommend changes.");
		return;
	}
	runGit(["apply", "--check", "-"], { input: response.unifiedDiff });
	runGit(["apply", "-"], { input: response.unifiedDiff });
	console.log(response.summary);
}

function valueAfter(args, key) {
	const index = args.indexOf(key);
	if (index === -1) {
		return undefined;
	}
	return args[index + 1];
}

function requiredValueAfter(args, key) {
	const value = valueAfter(args, key);
	if (!value) {
		throw new Error(`Missing value for ${key}`);
	}
	return value;
}

async function main() {
	const argv = process.argv.slice(2);
	if (argv[0] === "--") {
		argv.shift();
	}
	const [command, ...args] = argv;
	if (command === "assess") {
		await commandAssess(args);
		return;
	}
	if (command === "call") {
		await commandCall(args);
		return;
	}
	if (command === "apply") {
		await commandApply(args);
		return;
	}
	throw new Error("Usage: review-model-sync.mjs <assess|call|apply>");
}

if (process.argv[1]?.endsWith("review-model-sync.mjs")) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
