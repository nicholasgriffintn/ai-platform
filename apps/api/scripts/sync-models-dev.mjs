#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const API_URL_DEFAULT = "https://models.dev/api.json";
const POLYCHAT_API_BASE_URL_DEFAULT = "https://api.polychat.app";

const PROVIDER_ALIASES = {
	"azure-openai": "azure",
	bedrock: "amazon-bedrock",
	"workers-ai": "cloudflare-workers-ai",
	"together-ai": "togetherai",
	"google-ai-studio": "google",
	fireworks: "fireworks-ai",
	ollama: "ollama-cloud",
	grok: "xai",
	"perplexity-ai": "perplexity",
};

const LATEST_TAGS = new Set(["latest", "current"]);
const OUTDATED_TAGS = new Set(["deprecated", "legacy", "retired", "obsolete", "outdated"]);
const VERSION_SUFFIX_REGEX = /^(.*?)[-_:]((?:19|20)\d{2}(?:[-_]?\d{2}){1,2}|v?\d{4,})$/i;
const CURRENT_ALIAS_SUFFIX_REGEX = /^(.*?)[-_:](0|latest)$/i;

const IGNORED_REMOTE_MODEL_IDS = {
	mistral: new Set(["mistral-nemo"]),
};

const SUPPORTED_MODALITIES = new Set([
	"text",
	"image",
	"audio",
	"video",
	"pdf",
	"document",
	"embedding",
	"moderation",
	"speech",
	"voice-activity-detection",
	"guardrails",
	"reranking",
	"search",
	"creative",
	"instruction",
	"summarization",
	"multilingual",
	"general_knowledge",
	"coding",
	"reasoning",
	"vision",
	"chat",
	"math",
	"analysis",
	"tool_use",
	"academic",
	"research",
	"agents",
	"ocr",
	"transcription",
]);

const UPDATE_FIELD_ORDER = [
	"name",
	"matchingModel",
	"provider",
	"knowledgeCutoffDate",
	"releaseDate",
	"lastUpdated",
	"modalities",
	"supportsAttachments",
	"supportsTemperature",
	"supportsToolCalls",
	"supportsResponseFormat",
	"contextWindow",
	"maxTokens",
	"costPer1kInputTokens",
	"costPer1kOutputTokens",
	"costPer1kReasoningTokens",
	"strengths",
	"contextComplexity",
	"reliability",
	"speed",
	"reasoningConfig",
	"artificialAnalysis",
];

const UNPARSEABLE = Symbol("unparseable");

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const API_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_MODELS_DIR = path.join(API_ROOT, "src/data-model/models");

function parseArgs(argv) {
	const options = {
		apiUrl: API_URL_DEFAULT,
		modelsDir: DEFAULT_MODELS_DIR,
		write: false,
		verbose: false,
		help: false,
		providers: new Set(),
		triggerAnalysisTask: process.env.POLYCHAT_MODEL_ANALYSIS_TRIGGER === "true",
		polychatApiBaseUrl: process.env.POLYCHAT_API_BASE_URL || POLYCHAT_API_BASE_URL_DEFAULT,
		polychatApiKey: process.env.POLYCHAT_API_KEY,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];

		if (arg === "--write") {
			options.write = true;
			continue;
		}

		if (arg === "--verbose") {
			options.verbose = true;
			continue;
		}

		if (arg === "--trigger-analysis-task") {
			options.triggerAnalysisTask = true;
			continue;
		}

		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}

		if (arg === "--provider") {
			const value = argv[i + 1];
			if (!value) {
				throw new Error("Missing value for --provider");
			}
			options.providers.add(value);
			i += 1;
			continue;
		}

		if (arg.startsWith("--provider=")) {
			options.providers.add(arg.slice("--provider=".length));
			continue;
		}

		if (arg === "--api-url") {
			const value = argv[i + 1];
			if (!value) {
				throw new Error("Missing value for --api-url");
			}
			options.apiUrl = value;
			i += 1;
			continue;
		}

		if (arg.startsWith("--api-url=")) {
			options.apiUrl = arg.slice("--api-url=".length);
			continue;
		}

		if (arg === "--models-dir") {
			const value = argv[i + 1];
			if (!value) {
				throw new Error("Missing value for --models-dir");
			}
			options.modelsDir = path.resolve(value);
			i += 1;
			continue;
		}

		if (arg.startsWith("--models-dir=")) {
			options.modelsDir = path.resolve(arg.slice("--models-dir=".length));
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	return options;
}

function printHelp() {
	console.log(`Sync provider model configs from models.dev.

Usage:
  node scripts/sync-models-dev.mjs [options]

Options:
  --write                 Apply changes to files (default is dry run)
  --provider <id>         Only process a local provider (repeatable)
  --api-url <url>         Override models.dev API URL
  --models-dir <path>     Override model config directory
  --verbose               Print per-file details
  --trigger-analysis-task Trigger the Polychat Artificial Analysis ingestion task after sync
  --help, -h              Show this help

Environment:
  POLYCHAT_API_BASE_URL   Polychat API base URL (defaults to ${POLYCHAT_API_BASE_URL_DEFAULT})
  POLYCHAT_API_KEY        API key used for cached Artificial Analysis data and the trigger
`);
}

async function fetchApiData(apiUrl) {
	const response = await fetch(apiUrl, {
		headers: {
			accept: "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch ${apiUrl}: ${response.status}`);
	}

	const json = await response.json();
	if (!json || typeof json !== "object" || Array.isArray(json)) {
		throw new Error("models.dev payload is not a provider map");
	}

	return json;
}

function buildArtificialAnalysisModelsUrl(apiUrl) {
	if (!apiUrl) {
		return null;
	}

	const url = new URL(apiUrl);
	if (!url.pathname.endsWith("/models/artificial-analysis")) {
		return new URL("/models/artificial-analysis", url).toString();
	}
	return url.toString();
}

async function fetchArtificialAnalysisData({ apiUrl, apiKey }) {
	if (!apiKey) {
		return [];
	}

	const modelsUrl = buildArtificialAnalysisModelsUrl(apiUrl);
	if (!modelsUrl) {
		return [];
	}

	const models = [];
	let page = 1;

	while (true) {
		const url = new URL(modelsUrl);
		url.searchParams.set("page", String(page));
		if (!url.searchParams.has("limit")) {
			url.searchParams.set("limit", "100");
		}

		const response = await fetch(url, {
			headers: {
				accept: "application/json",
				authorization: `Bearer ${apiKey}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch ${url.toString()}: ${response.status}`);
		}

		const payload = await response.json();
		if (!payload || typeof payload !== "object" || !Array.isArray(payload.models)) {
			throw new Error("Polychat Artificial Analysis payload is not a model list");
		}

		models.push(...payload.models);
		const totalPages =
			typeof payload.pagination?.totalPages === "number" ? payload.pagination.totalPages : page;
		if (page >= totalPages) {
			break;
		}
		page += 1;
	}

	return models;
}

function buildAnalysisTriggerUrl(apiUrl) {
	return new URL("/admin/model-analysis/sync-completed", apiUrl).toString();
}

async function triggerAnalysisTask(options, stats) {
	if (!options.polychatApiKey) {
		throw new Error("Missing POLYCHAT_API_KEY for Artificial Analysis task trigger");
	}

	const response = await fetch(buildAnalysisTriggerUrl(options.polychatApiBaseUrl), {
		method: "POST",
		headers: {
			authorization: `Bearer ${options.polychatApiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			source: "models.dev",
			completedAt: new Date().toISOString(),
			write: options.write,
			stats,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to trigger Artificial Analysis ingestion task: ${response.status}`);
	}

	const json = await response.json();
	console.log(`Triggered Artificial Analysis ingestion task ${json.task_id || "unknown"}.`);
}

async function listTsFiles(dir) {
	const results = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await listTsFiles(fullPath)));
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".ts")) {
			results.push(fullPath);
		}
	}

	return results;
}

function hasExportModifier(node) {
	return (node.modifiers ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function findModelConfigDeclaration(sourceFile) {
	let result = null;

	function visit(node) {
		if (result) {
			return;
		}

		if (ts.isVariableStatement(node) && hasExportModifier(node)) {
			for (const declaration of node.declarationList.declarations) {
				if (!declaration.initializer || !declaration.type) {
					continue;
				}

				const typeText = declaration.type.getText(sourceFile);
				if (typeText !== "ModelConfig") {
					continue;
				}

				if (
					ts.isCallExpression(declaration.initializer) &&
					declaration.initializer.expression.getText(sourceFile) === "createModelConfigObject" &&
					declaration.initializer.arguments.length > 0 &&
					ts.isArrayLiteralExpression(declaration.initializer.arguments[0])
				) {
					result = {
						style: "array",
						variableName: declaration.name.getText(sourceFile),
						arrayNode: declaration.initializer.arguments[0],
					};
					return;
				}

				if (ts.isObjectLiteralExpression(declaration.initializer)) {
					result = {
						style: "object",
						variableName: declaration.name.getText(sourceFile),
						objectNode: declaration.initializer,
					};
					return;
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return result;
}

function getIndentAtPosition(text, position) {
	const lineStart = text.lastIndexOf("\n", position) + 1;
	let cursor = lineStart;

	while (cursor < text.length) {
		const char = text[cursor];
		if (char !== "\t" && char !== " ") {
			break;
		}
		cursor += 1;
	}

	return text.slice(lineStart, cursor);
}

function getLineStart(text, position) {
	return text.lastIndexOf("\n", position) + 1;
}

function getPropertyName(nameNode, sourceFile) {
	if (ts.isIdentifier(nameNode)) {
		return nameNode.text;
	}
	if (ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) {
		return nameNode.text;
	}
	if (ts.isNoSubstitutionTemplateLiteral(nameNode)) {
		return nameNode.text;
	}
	if (ts.isComputedPropertyName(nameNode)) {
		return nameNode.expression.getText(sourceFile);
	}
	return null;
}

function getPropertyAssignment(objectNode, propertyName, sourceFile) {
	for (const property of objectNode.properties) {
		if (!ts.isPropertyAssignment(property)) {
			continue;
		}
		if (getPropertyName(property.name, sourceFile) === propertyName) {
			return property;
		}
	}
	return null;
}

function getStringPropertyValue(objectNode, propertyName, sourceFile) {
	const property = getPropertyAssignment(objectNode, propertyName, sourceFile);
	if (!property) {
		return undefined;
	}
	if (
		ts.isStringLiteral(property.initializer) ||
		ts.isNoSubstitutionTemplateLiteral(property.initializer)
	) {
		return property.initializer.text;
	}
	return undefined;
}

function getObjectPropertyValue(objectNode, propertyName, sourceFile) {
	const property = getPropertyAssignment(objectNode, propertyName, sourceFile);
	if (!property || !ts.isObjectLiteralExpression(property.initializer)) {
		return undefined;
	}

	const parsed = parseLiteralValue(property.initializer, sourceFile);
	return parsed !== UNPARSEABLE && parsed && typeof parsed === "object" && !Array.isArray(parsed)
		? parsed
		: undefined;
}

function getReasoningOverrideModelIds(objectNode, sourceFile) {
	const reasoningConfig = getObjectPropertyValue(objectNode, "reasoningConfig", sourceFile);
	if (!reasoningConfig) {
		return [];
	}

	const modelOverrides = reasoningConfig.modelOverrides;
	if (!modelOverrides || typeof modelOverrides !== "object" || Array.isArray(modelOverrides)) {
		return [];
	}

	return Object.values(modelOverrides).filter((value) => typeof value === "string");
}

function findProviderFromConstant(sourceFile) {
	let provider = null;

	function visit(node) {
		if (provider) {
			return;
		}
		if (!ts.isVariableDeclaration(node)) {
			ts.forEachChild(node, visit);
			return;
		}
		if (node.name.getText(sourceFile) !== "PROVIDER") {
			return;
		}
		if (
			node.initializer &&
			(ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
		) {
			provider = node.initializer.text;
		}
	}

	visit(sourceFile);
	return provider;
}

function extractArrayEntries(arrayNode, sourceFile) {
	const entries = [];

	for (const element of arrayNode.elements) {
		if (!ts.isCallExpression(element)) {
			continue;
		}
		if (element.expression.getText(sourceFile) !== "createModelConfig") {
			continue;
		}
		if (element.arguments.length < 3) {
			continue;
		}

		const keyArg = element.arguments[0];
		const configArg = element.arguments[2];

		if (!ts.isStringLiteralLike(keyArg)) {
			continue;
		}
		if (!ts.isObjectLiteralExpression(configArg)) {
			continue;
		}

		entries.push({
			modelKey: keyArg.text,
			entryNode: element,
			objectNode: configArg,
		});
	}

	return entries;
}

function extractObjectEntries(outerObjectNode, sourceFile) {
	const entries = [];

	for (const property of outerObjectNode.properties) {
		if (!ts.isPropertyAssignment(property)) {
			continue;
		}
		if (!ts.isObjectLiteralExpression(property.initializer)) {
			continue;
		}

		const modelKey = getPropertyName(property.name, sourceFile);
		if (!modelKey) {
			continue;
		}

		entries.push({
			modelKey,
			entryNode: property,
			objectNode: property.initializer,
		});
	}

	return entries;
}

function inferProviderFromObjectEntries(entries, sourceFile) {
	for (const entry of entries) {
		const provider = getStringPropertyValue(entry.objectNode, "provider", sourceFile);
		if (provider) {
			return provider;
		}
	}
	return null;
}

function hasOwn(objectValue, key) {
	return Object.prototype.hasOwnProperty.call(objectValue, key);
}

function readNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function scoreHigherIsBetter(value, thresholds) {
	if (value === undefined) {
		return undefined;
	}
	for (let index = 0; index < thresholds.length; index += 1) {
		if (value >= thresholds[index]) {
			return thresholds.length - index + 1;
		}
	}
	return value > 0 ? 1 : undefined;
}

function scoreLowerIsBetter(value, thresholds) {
	if (value === undefined) {
		return undefined;
	}
	for (let index = 0; index < thresholds.length; index += 1) {
		if (value <= thresholds[index]) {
			return thresholds.length - index + 1;
		}
	}
	return value > 0 ? 1 : undefined;
}

function averageDefined(values) {
	const defined = values.filter((value) => value !== undefined);
	if (defined.length === 0) {
		return undefined;
	}
	return defined.reduce((total, value) => total + value, 0) / defined.length;
}

function clampRouterScore(value) {
	if (value === undefined) {
		return undefined;
	}
	return Math.min(5, Math.max(1, Math.round(value)));
}

function normaliseLookupKey(value) {
	if (!value) {
		return null;
	}

	const normalised = String(value)
		.toLowerCase()
		.replace(/\([^)]*\)/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return normalised || null;
}

function addLookupKey(keys, value) {
	const key = normaliseLookupKey(value);
	if (key) {
		keys.add(key);
	}
}

function addModelLookupKeys(keys, value) {
	if (!value) {
		return;
	}
	addLookupKey(keys, value);
	if (String(value).includes("/")) {
		addLookupKey(keys, String(value).split("/").at(-1));
	}
}

function buildArtificialAnalysisLookup(models) {
	const lookup = new Map();

	for (const model of models) {
		const keys = new Set();
		addLookupKey(keys, model.id);
		addLookupKey(keys, model.name);
		addLookupKey(keys, model.slug);

		for (const key of keys) {
			if (!lookup.has(key)) {
				lookup.set(key, model);
			}
		}
	}

	return lookup;
}

function findArtificialAnalysisModel({ lookup, entry, remoteModel, remoteModelId, sourceFile }) {
	if (!lookup || lookup.size === 0) {
		return null;
	}

	const keys = new Set();
	addModelLookupKeys(keys, entry.modelKey);
	addModelLookupKeys(keys, remoteModelId);
	addModelLookupKeys(keys, getStringPropertyValue(entry.objectNode, "matchingModel", sourceFile));
	addModelLookupKeys(keys, getStringPropertyValue(entry.objectNode, "name", sourceFile));
	if (remoteModel && typeof remoteModel === "object") {
		addModelLookupKeys(keys, remoteModel.id);
		addModelLookupKeys(keys, remoteModel.name);
	}

	for (const key of keys) {
		const analysisModel = lookup.get(key);
		if (analysisModel) {
			return analysisModel;
		}
	}
	return null;
}

function deriveArtificialAnalysisScores(model) {
	const evaluations = readRecord(model.evaluations);
	const derivedScores = readRecord(model.derived_scores);
	const intelligence =
		readNumber(derivedScores.intelligence) ??
		scoreHigherIsBetter(
			readNumber(model.intelligence_index) ??
				readNumber(evaluations.artificial_analysis_intelligence_index),
			[80, 65, 50, 35],
		);
	const coding =
		readNumber(derivedScores.coding) ??
		scoreHigherIsBetter(
			readNumber(model.coding_index) ?? readNumber(evaluations.artificial_analysis_coding_index),
			[80, 60, 45, 30],
		);
	const agentic =
		readNumber(derivedScores.agentic) ??
		scoreHigherIsBetter(
			readNumber(model.agentic_index) ?? readNumber(evaluations.artificial_analysis_agentic_index),
			[80, 65, 50, 35],
		);
	const outputSpeed =
		readNumber(derivedScores.outputSpeed) ??
		scoreHigherIsBetter(readNumber(model.median_output_tokens_per_second), [180, 100, 50, 20]);
	const firstTokenLatency =
		readNumber(derivedScores.firstTokenLatency) ??
		scoreLowerIsBetter(readNumber(model.median_time_to_first_token_seconds), [0.5, 1, 3, 8]);

	return {
		intelligence,
		coding,
		agentic,
		outputSpeed,
		firstTokenLatency,
	};
}

function pushStrength(strengths, value, enabled) {
	if (enabled && SUPPORTED_MODALITIES.has(value) && !strengths.includes(value)) {
		strengths.push(value);
	}
}

function getExistingFieldValue(objectNode, propertyName, sourceFile) {
	if (!objectNode || !sourceFile) {
		return undefined;
	}

	const property = getPropertyAssignment(objectNode, propertyName, sourceFile);
	if (!property) {
		return undefined;
	}

	const parsed = parseLiteralValue(property.initializer, sourceFile);
	return parsed === UNPARSEABLE ? undefined : parsed;
}

function buildEffectiveModelProfile(objectNode, sourceFile, baseValues = {}) {
	const profile = {};
	for (const fieldName of [
		"modalities",
		"supportsAttachments",
		"supportsToolCalls",
		"supportsResponseFormat",
		"supportsSearchGrounding",
		"supportsCodeExecution",
		"supportsWebFetch",
		"supportsDocuments",
		"supportsAudio",
		"supportsArtifacts",
		"contextWindow",
		"maxTokens",
		"costPer1kInputTokens",
		"costPer1kOutputTokens",
		"reasoningConfig",
		"strengths",
	]) {
		const existingValue = getExistingFieldValue(objectNode, fieldName, sourceFile);
		if (existingValue !== undefined) {
			profile[fieldName] = existingValue;
		}
		if (baseValues[fieldName] !== undefined) {
			profile[fieldName] = baseValues[fieldName];
		}
	}
	return profile;
}

function modalityListIncludes(modalities, sectionName, value) {
	const values = modalities?.[sectionName];
	return Array.isArray(values) && values.includes(value);
}

function deriveCapabilityScores(profile) {
	const contextWindow = readNumber(profile.contextWindow);
	const maxTokens = readNumber(profile.maxTokens);
	const modalities =
		profile.modalities && typeof profile.modalities === "object" ? profile.modalities : undefined;
	const supportsRichInput =
		modalityListIncludes(modalities, "input", "image") ||
		modalityListIncludes(modalities, "input", "pdf") ||
		modalityListIncludes(modalities, "input", "document") ||
		modalityListIncludes(modalities, "input", "audio") ||
		modalityListIncludes(modalities, "input", "video") ||
		profile.supportsAttachments === true ||
		profile.supportsDocuments === true ||
		profile.supportsAudio === true;
	const supportsTools =
		profile.supportsToolCalls === true ||
		profile.supportsSearchGrounding === true ||
		profile.supportsCodeExecution === true ||
		profile.supportsWebFetch === true;

	return {
		contextWindow: scoreHigherIsBetter(contextWindow, [1_000_000, 200_000, 128_000, 32_000]),
		maxTokens: scoreHigherIsBetter(maxTokens, [128_000, 64_000, 32_000, 8_000]),
		richInput: supportsRichInput ? 4 : undefined,
		tools: supportsTools ? 4 : undefined,
	};
}

function deriveArtificialAnalysisStrengths(model, scores, profile) {
	const existingStrengths = Array.isArray(profile.strengths) ? profile.strengths : [];
	const strengths = existingStrengths.filter(
		(value) => typeof value === "string" && SUPPORTED_MODALITIES.has(value),
	);
	const derivedStrengths = Array.isArray(model.derived_strengths) ? model.derived_strengths : [];
	const modalities =
		profile.modalities && typeof profile.modalities === "object" ? profile.modalities : undefined;

	for (const strength of derivedStrengths) {
		pushStrength(strengths, strength, true);
	}

	pushStrength(strengths, "vision", modalityListIncludes(modalities, "input", "image"));
	pushStrength(strengths, "document", modalityListIncludes(modalities, "input", "pdf"));
	pushStrength(strengths, "document", modalityListIncludes(modalities, "input", "document"));
	pushStrength(strengths, "audio", modalityListIncludes(modalities, "input", "audio"));
	pushStrength(strengths, "video", modalityListIncludes(modalities, "input", "video"));
	pushStrength(strengths, "document", profile.supportsAttachments === true);
	pushStrength(strengths, "document", profile.supportsDocuments === true);
	pushStrength(strengths, "tool_use", profile.supportsToolCalls === true);
	pushStrength(strengths, "search", profile.supportsSearchGrounding === true);
	pushStrength(strengths, "research", profile.supportsWebFetch === true);
	pushStrength(strengths, "coding", profile.supportsCodeExecution === true);
	pushStrength(strengths, "audio", profile.supportsAudio === true);
	pushStrength(strengths, "general_knowledge", (scores.intelligence ?? 0) >= 4);
	pushStrength(strengths, "analysis", (scores.intelligence ?? 0) >= 4);
	pushStrength(strengths, "reasoning", (scores.intelligence ?? 0) >= 4);
	pushStrength(strengths, "coding", (scores.coding ?? 0) >= 4);
	pushStrength(strengths, "agents", (scores.agentic ?? 0) >= 4);
	pushStrength(strengths, "instruction", (scores.agentic ?? 0) >= 4);

	return strengths;
}

function per1kFromPer1m(value) {
	const numberValue = readNumber(value);
	return numberValue === undefined
		? undefined
		: Number.parseFloat((numberValue / 1000).toFixed(10));
}

function buildArtificialAnalysisUpdateValues(model, objectNode, sourceFile, baseValues = {}) {
	if (!model) {
		return {};
	}

	const evaluations = readRecord(model.evaluations);
	const scores = deriveArtificialAnalysisScores(model);
	const profile = buildEffectiveModelProfile(objectNode, sourceFile, baseValues);
	const capabilityScores = deriveCapabilityScores(profile);
	const values = {
		artificialAnalysis: {
			intelligenceIndex:
				readNumber(model.intelligence_index) ??
				readNumber(evaluations.artificial_analysis_intelligence_index) ??
				null,
			codingIndex:
				readNumber(model.coding_index) ??
				readNumber(evaluations.artificial_analysis_coding_index) ??
				null,
			agenticIndex:
				readNumber(model.agentic_index) ??
				readNumber(evaluations.artificial_analysis_agentic_index) ??
				null,
			intelligenceIndexVersion: readNumber(model.intelligence_index_version) ?? null,
		},
	};

	const strengths = deriveArtificialAnalysisStrengths(model, scores, profile);
	if (strengths.length > 0) {
		values.strengths = strengths;
	}

	const contextComplexity = clampRouterScore(
		Math.max(
			scores.intelligence ?? 0,
			scores.coding ?? 0,
			scores.agentic ?? 0,
			averageDefined([
				capabilityScores.contextWindow,
				capabilityScores.maxTokens,
				capabilityScores.richInput,
				capabilityScores.tools,
			]) ?? 0,
		) || undefined,
	);
	if (contextComplexity !== undefined) {
		values.contextComplexity = contextComplexity;
	}

	const reliability = clampRouterScore(
		averageDefined([scores.intelligence, scores.coding, scores.agentic]),
	);
	if (reliability !== undefined) {
		values.reliability = reliability;
	}

	const speed = clampRouterScore(
		averageDefined([scores.outputSpeed, scores.outputSpeed, scores.firstTokenLatency]),
	);
	if (speed !== undefined) {
		values.speed = speed;
	}

	const inputCost = per1kFromPer1m(model.price_1m_input_tokens);
	if (inputCost !== undefined && readNumber(profile.costPer1kInputTokens) === undefined) {
		values.costPer1kInputTokens = inputCost;
	}

	const outputCost = per1kFromPer1m(model.price_1m_output_tokens);
	if (outputCost !== undefined && readNumber(profile.costPer1kOutputTokens) === undefined) {
		values.costPer1kOutputTokens = outputCost;
	}

	return values;
}

function hasDeprecatedStatus(remoteConfig) {
	return (
		remoteConfig !== null &&
		typeof remoteConfig === "object" &&
		remoteConfig.status === "deprecated"
	);
}

function normalizeTags(remoteModel) {
	if (!remoteModel || typeof remoteModel !== "object") {
		return [];
	}
	const tags = remoteModel.tags;
	if (!Array.isArray(tags)) {
		return [];
	}
	return tags.filter((tag) => typeof tag === "string").map((tag) => tag.toLowerCase());
}

function hasAnyTag(remoteModel, tagSet) {
	return normalizeTags(remoteModel).some((tag) => tagSet.has(tag));
}

function isIgnoredRemoteModelId(provider, modelId) {
	return IGNORED_REMOTE_MODEL_IDS[provider]?.has(modelId) ?? false;
}

function anthropicModelFamilyKey(modelId) {
	if (!modelId.startsWith("claude-")) {
		return modelId;
	}

	const tokens = modelId
		.replace(/^claude-/, "")
		.replace(/-(latest|0)$/i, "")
		.replace(/-20\d{6}$/i, "")
		.split(/[-.]/);
	const modelClass = tokens.find((token) => ["opus", "sonnet", "haiku"].includes(token));
	if (!modelClass) {
		return modelId;
	}

	const versionTokens = tokens.filter((token) => /^\d+$/.test(token) && token.length < 6);
	if (versionTokens[1] === "0") {
		return `claude-${modelClass}-${versionTokens[0]}`;
	}
	if (versionTokens.length > 0) {
		return `claude-${modelClass}-${versionTokens.slice(0, 2).join("-")}`;
	}

	return `claude-${modelClass}`;
}

function modelFamilyKey(modelId, provider) {
	if (provider === "anthropic") {
		return anthropicModelFamilyKey(modelId);
	}

	const match = VERSION_SUFFIX_REGEX.exec(modelId);
	if (match) {
		return match[1];
	}
	const currentAliasMatch = CURRENT_ALIAS_SUFFIX_REGEX.exec(modelId);
	return currentAliasMatch ? currentAliasMatch[1] : modelId;
}

function getRemoteModelDateValue(remoteModel) {
	for (const fieldName of ["last_updated", "release_date"]) {
		const value = remoteModel[fieldName];
		if (typeof value !== "string") {
			continue;
		}
		const timestamp = Date.parse(value);
		if (Number.isFinite(timestamp)) {
			return timestamp;
		}
	}
	return undefined;
}

function getVersionSuffixValue(modelId) {
	const match = VERSION_SUFFIX_REGEX.exec(modelId);
	if (!match) {
		return undefined;
	}
	return Number(match[2].replace(/\D/g, ""));
}

function inferPreferredFamilyModelIds(modelIds, remoteModels, provider) {
	const unversionedModelIds = modelIds.filter(
		(modelId) => modelFamilyKey(modelId, provider) === modelId,
	);
	if (unversionedModelIds.length > 0) {
		return new Set(unversionedModelIds);
	}

	const currentAliasModelIds = modelIds.filter((modelId) => {
		return CURRENT_ALIAS_SUFFIX_REGEX.test(modelId);
	});
	if (currentAliasModelIds.length > 0) {
		return new Set(currentAliasModelIds);
	}

	let bestScore = Number.NEGATIVE_INFINITY;
	const preferredModelIds = new Set();
	for (const modelId of modelIds) {
		const remoteModel = remoteModels[modelId];
		const dateValue = getRemoteModelDateValue(remoteModel);
		const versionValue = getVersionSuffixValue(modelId);
		const score = dateValue ?? versionValue;
		if (score === undefined) {
			preferredModelIds.add(modelId);
			continue;
		}
		if (score > bestScore) {
			bestScore = score;
			preferredModelIds.clear();
			preferredModelIds.add(modelId);
			continue;
		}
		if (score === bestScore) {
			preferredModelIds.add(modelId);
		}
	}

	return preferredModelIds;
}

function buildProviderModelFamilies(remoteModels, provider) {
	const families = new Map();
	for (const [modelId, remoteModel] of Object.entries(remoteModels)) {
		if (!remoteModel || typeof remoteModel !== "object") {
			continue;
		}
		if (isIgnoredRemoteModelId(provider, modelId)) {
			continue;
		}
		const family = modelFamilyKey(modelId, provider);
		if (!families.has(family)) {
			families.set(family, new Set());
		}
		families.get(family).add(modelId);
	}
	return families;
}

function buildProviderModelStatus(remoteModels, provider) {
	const latestModelIds = new Set();
	const outdatedModelIds = new Set();
	const familyMembers = new Map();
	const familyLatestModelIds = new Map();

	for (const [modelId, remoteModel] of Object.entries(remoteModels)) {
		if (!remoteModel || typeof remoteModel !== "object") {
			continue;
		}
		if (isIgnoredRemoteModelId(provider, modelId)) {
			continue;
		}
		const family = modelFamilyKey(modelId, provider);
		if (!familyMembers.has(family)) {
			familyMembers.set(family, []);
		}
		familyMembers.get(family).push(modelId);

		if (hasDeprecatedStatus(remoteModel) || hasAnyTag(remoteModel, OUTDATED_TAGS)) {
			outdatedModelIds.add(modelId);
		}
		if (
			remoteModel.latest === true ||
			remoteModel.is_latest === true ||
			hasAnyTag(remoteModel, LATEST_TAGS)
		) {
			latestModelIds.add(modelId);
			if (!familyLatestModelIds.has(family)) {
				familyLatestModelIds.set(family, new Set());
			}
			familyLatestModelIds.get(family).add(modelId);
		}
	}

	for (const [family, modelIds] of familyMembers) {
		if (familyLatestModelIds.has(family)) {
			const familyLatestIds = familyLatestModelIds.get(family);
			for (const modelId of modelIds) {
				if (!familyLatestIds.has(modelId)) {
					outdatedModelIds.add(modelId);
				}
			}
			continue;
		}

		if (modelIds.length > 1) {
			const preferredModelIds = inferPreferredFamilyModelIds(modelIds, remoteModels, provider);
			for (const modelId of modelIds) {
				if (!preferredModelIds.has(modelId)) {
					outdatedModelIds.add(modelId);
				}
			}
		}
	}

	return { latestModelIds, outdatedModelIds };
}

function formatMonth(year, month) {
	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	return months[month - 1] ?? `${year}-${String(month).padStart(2, "0")}`;
}

function formatHumanDate(value) {
	if (!value || typeof value !== "string") {
		return undefined;
	}

	const fullDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (fullDate) {
		const year = Number(fullDate[1]);
		const month = Number(fullDate[2]);
		const day = Number(fullDate[3]);
		return `${formatMonth(year, month)} ${day}, ${year}`;
	}

	const yearMonth = /^(\d{4})-(\d{2})$/.exec(value);
	if (yearMonth) {
		const year = Number(yearMonth[1]);
		const month = Number(yearMonth[2]);
		return `${formatMonth(year, month)} ${year}`;
	}

	return value;
}

function normalizeModalityList(values) {
	if (!Array.isArray(values)) {
		return [];
	}
	const filtered = [];
	for (const value of values) {
		if (typeof value !== "string") {
			continue;
		}
		if (!SUPPORTED_MODALITIES.has(value)) {
			continue;
		}
		filtered.push(value);
	}
	return filtered;
}

function normalizeModalities(modalities, { defaultToText } = { defaultToText: false }) {
	if (!modalities || typeof modalities !== "object") {
		if (!defaultToText) {
			return undefined;
		}
		return {
			input: ["text"],
			output: ["text"],
		};
	}

	const input = normalizeModalityList(modalities.input);
	const output = normalizeModalityList(modalities.output);

	if (input.length === 0) {
		if (!defaultToText) {
			return undefined;
		}
		return {
			input: ["text"],
			output: output.length > 0 ? output : ["text"],
		};
	}

	if (output.length === 0 && defaultToText) {
		return { input, output: ["text"] };
	}

	return output.length > 0 ? { input, output } : { input };
}

function toPer1k(value) {
	if (typeof value !== "number" || Number.isNaN(value)) {
		return undefined;
	}
	const converted = value / 1000;
	const normalized = Number.parseFloat(converted.toFixed(10));
	return Number.isFinite(normalized) ? normalized : undefined;
}

function buildUpdateValues(
	remoteModel,
	{
		modelKey,
		existingMatchingModel,
		allowMatchingModelUpdate,
		isNewEntry,
		includeProvider,
		provider,
	},
) {
	const values = {};
	const remoteId = typeof remoteModel.id === "string" ? remoteModel.id : modelKey;

	if (isNewEntry && typeof remoteModel.name === "string" && remoteModel.name.length > 0) {
		values.name = remoteModel.name;
	}

	if (allowMatchingModelUpdate || isNewEntry) {
		values.matchingModel = remoteId;
	} else if (!existingMatchingModel && remoteId) {
		values.matchingModel = remoteId;
	}

	if (includeProvider && provider) {
		values.provider = provider;
	}

	const knowledgeDate = formatHumanDate(remoteModel.knowledge);
	if (knowledgeDate) {
		values.knowledgeCutoffDate = knowledgeDate;
	}

	const releaseDate = formatHumanDate(remoteModel.release_date);
	if (releaseDate) {
		values.releaseDate = releaseDate;
	}

	const lastUpdated = formatHumanDate(remoteModel.last_updated);
	if (lastUpdated) {
		values.lastUpdated = lastUpdated;
	}

	const modalities = normalizeModalities(remoteModel.modalities, {
		defaultToText: isNewEntry,
	});
	if (modalities && isNewEntry) {
		values.modalities = modalities;
	}

	if (hasOwn(remoteModel, "attachment")) {
		values.supportsAttachments = Boolean(remoteModel.attachment);
	}
	if (hasOwn(remoteModel, "temperature")) {
		values.supportsTemperature = Boolean(remoteModel.temperature);
	}
	if (hasOwn(remoteModel, "tool_call")) {
		values.supportsToolCalls = Boolean(remoteModel.tool_call);
	}
	if (hasOwn(remoteModel, "structured_output")) {
		values.supportsResponseFormat = Boolean(remoteModel.structured_output);
	}

	if (remoteModel.limit && typeof remoteModel.limit === "object") {
		if (typeof remoteModel.limit.context === "number") {
			values.contextWindow = remoteModel.limit.context;
		}
		if (typeof remoteModel.limit.output === "number") {
			values.maxTokens = remoteModel.limit.output;
		}
	}

	if (remoteModel.cost && typeof remoteModel.cost === "object") {
		const inputCost = toPer1k(remoteModel.cost.input);
		if (inputCost !== undefined) {
			values.costPer1kInputTokens = inputCost;
		}

		const outputCost = toPer1k(remoteModel.cost.output);
		if (outputCost !== undefined) {
			values.costPer1kOutputTokens = outputCost;
		}

		const reasoningCost = toPer1k(remoteModel.cost.reasoning);
		if (reasoningCost !== undefined) {
			values.costPer1kReasoningTokens = reasoningCost;
		}
	}

	if (hasOwn(remoteModel, "reasoning") && remoteModel.reasoning) {
		values.reasoningConfig = {
			supportedEffortLevels: ["none", "thinking"],
			defaultEffort: "none",
		};
	}

	return values;
}

function formatNumber(value) {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return "0";
	}
	if (Number.isInteger(value)) {
		return String(value);
	}
	const formatted = value.toFixed(10).replace(/\.?0+$/, "");
	return formatted.length > 0 ? formatted : "0";
}

function formatValue(value, indent) {
	if (typeof value === "string") {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		return formatNumber(value);
	}
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}
	if (value === null) {
		return "null";
	}

	if (Array.isArray(value)) {
		return `[${value.map((item) => formatValue(item, indent)).join(", ")}]`;
	}

	if (value && typeof value === "object") {
		const entries = Object.entries(value).filter(([, entryValue]) => {
			return entryValue !== undefined;
		});
		if (entries.length === 0) {
			return "{}";
		}

		const childIndent = `${indent}\t`;
		const lines = entries.map(([key, entryValue]) => {
			return `${childIndent}${key}: ${formatValue(entryValue, childIndent)},`;
		});
		return `{\n${lines.join("\n")}\n${indent}}`;
	}

	return "undefined";
}

function parseLiteralValue(node, sourceFile) {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	if (ts.isNumericLiteral(node)) {
		return Number(node.text);
	}
	if (
		ts.isPrefixUnaryExpression(node) &&
		node.operator === ts.SyntaxKind.MinusToken &&
		ts.isNumericLiteral(node.operand)
	) {
		return -Number(node.operand.text);
	}
	if (node.kind === ts.SyntaxKind.TrueKeyword) {
		return true;
	}
	if (node.kind === ts.SyntaxKind.FalseKeyword) {
		return false;
	}
	if (node.kind === ts.SyntaxKind.NullKeyword) {
		return null;
	}
	if (ts.isArrayLiteralExpression(node)) {
		const items = [];
		for (const element of node.elements) {
			const parsed = parseLiteralValue(element, sourceFile);
			if (parsed === UNPARSEABLE) {
				return UNPARSEABLE;
			}
			items.push(parsed);
		}
		return items;
	}
	if (ts.isObjectLiteralExpression(node)) {
		const objectValue = {};
		for (const property of node.properties) {
			if (!ts.isPropertyAssignment(property)) {
				return UNPARSEABLE;
			}
			const key = getPropertyName(property.name, sourceFile);
			if (!key) {
				return UNPARSEABLE;
			}
			const parsed = parseLiteralValue(property.initializer, sourceFile);
			if (parsed === UNPARSEABLE) {
				return UNPARSEABLE;
			}
			objectValue[key] = parsed;
		}
		return objectValue;
	}
	return UNPARSEABLE;
}

function deepEqual(left, right) {
	if (typeof left === "number" && typeof right === "number") {
		return Math.abs(left - right) < 1e-12;
	}
	if (left === right) {
		return true;
	}
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) {
			return false;
		}
		for (let i = 0; i < left.length; i += 1) {
			if (!deepEqual(left[i], right[i])) {
				return false;
			}
		}
		return true;
	}
	if (
		left &&
		right &&
		typeof left === "object" &&
		typeof right === "object" &&
		!Array.isArray(left) &&
		!Array.isArray(right)
	) {
		const leftKeys = Object.keys(left);
		const rightKeys = Object.keys(right);
		if (leftKeys.length !== rightKeys.length) {
			return false;
		}
		for (const key of leftKeys) {
			if (!hasOwn(right, key)) {
				return false;
			}
			if (!deepEqual(left[key], right[key])) {
				return false;
			}
		}
		return true;
	}
	return false;
}

function buildObjectPatches({ fileText, sourceFile, objectNode, values }) {
	const patches = [];
	const missingFields = [];
	const fieldMap = new Map();

	for (const property of objectNode.properties) {
		if (!ts.isPropertyAssignment(property)) {
			continue;
		}
		const propertyName = getPropertyName(property.name, sourceFile);
		if (!propertyName) {
			continue;
		}
		fieldMap.set(propertyName, property);
	}

	for (const fieldName of UPDATE_FIELD_ORDER) {
		if (!hasOwn(values, fieldName)) {
			continue;
		}

		const nextValue = values[fieldName];
		const property = fieldMap.get(fieldName);

		if (!property) {
			missingFields.push([fieldName, nextValue]);
			continue;
		}

		// Preserve provider-specific reasoning config details if already present.
		if (fieldName === "reasoningConfig") {
			continue;
		}

		const parsedValue = parseLiteralValue(property.initializer, sourceFile);
		if (parsedValue !== UNPARSEABLE && deepEqual(parsedValue, nextValue)) {
			continue;
		}

		const propertyIndent = getIndentAtPosition(fileText, property.getStart(sourceFile));
		const replacementText = formatValue(nextValue, propertyIndent);
		patches.push({
			start: property.initializer.getStart(sourceFile),
			end: property.initializer.end,
			text: replacementText,
		});
	}

	if (missingFields.length > 0) {
		const objectIndent = getIndentAtPosition(fileText, objectNode.getStart(sourceFile));
		const propertyIndent = `${objectIndent}\t`;
		const insertionText = missingFields
			.map(([fieldName, fieldValue]) => {
				return `${propertyIndent}${fieldName}: ${formatValue(fieldValue, propertyIndent)},`;
			})
			.join("\n");

		const closeBracePosition = objectNode.end - 1;
		const insertionPoint = getLineStart(fileText, closeBracePosition);
		patches.push({
			start: insertionPoint,
			end: insertionPoint,
			text: `${insertionText}\n`,
		});
	}

	return patches;
}

function orderedEntries(values) {
	const entries = [];
	for (const fieldName of UPDATE_FIELD_ORDER) {
		if (hasOwn(values, fieldName) && values[fieldName] !== undefined) {
			entries.push([fieldName, values[fieldName]]);
		}
	}
	return entries;
}

function formatNewObjectEntry(modelId, values, entryIndent) {
	const propertyIndent = `${entryIndent}\t`;
	const lines = orderedEntries(values).map(([fieldName, fieldValue]) => {
		return `${propertyIndent}${fieldName}: ${formatValue(fieldValue, propertyIndent)},`;
	});

	return `${entryIndent}${JSON.stringify(modelId)}: {\n${lines.join("\n")}\n${entryIndent}},`;
}

function formatNewArrayEntry(modelId, values, entryIndent) {
	const propertyIndent = `${entryIndent}\t`;
	const lines = orderedEntries(values).map(([fieldName, fieldValue]) => {
		if (fieldName === "provider") {
			return null;
		}
		return `${propertyIndent}${fieldName}: ${formatValue(fieldValue, propertyIndent)},`;
	});

	const filteredLines = lines.filter(Boolean);
	return `${entryIndent}createModelConfig(${JSON.stringify(modelId)}, PROVIDER, {\n${filteredLines.join("\n")}\n${entryIndent}}),`;
}

function applyPatches(text, patches) {
	const sorted = [...patches].sort((left, right) => {
		if (left.start !== right.start) {
			return right.start - left.start;
		}
		return right.end - left.end;
	});

	let nextText = text;
	for (const patch of sorted) {
		nextText = nextText.slice(0, patch.start) + patch.text + nextText.slice(patch.end);
	}

	return nextText;
}

function buildRemoveEntryPatch(fileText, entryNode, sourceFile) {
	const start = getLineStart(fileText, entryNode.getStart(sourceFile));
	let end = entryNode.end;

	while (fileText[end] === " " || fileText[end] === "\t") {
		end += 1;
	}
	if (fileText[end] === ",") {
		end += 1;
	}
	while (fileText[end] === " " || fileText[end] === "\t") {
		end += 1;
	}
	if (fileText[end] === "\r" && fileText[end + 1] === "\n") {
		end += 2;
	} else if (fileText[end] === "\n") {
		end += 1;
	}

	if (fileText.slice(end, end + 1) === "\n") {
		end += 1;
	}

	return {
		start,
		end,
		text: "",
	};
}

function shouldProcessProvider(localProvider, remoteProvider, selectedProviders) {
	if (selectedProviders.size === 0) {
		return true;
	}
	return selectedProviders.has(localProvider) || selectedProviders.has(remoteProvider);
}

function shouldUpdateMatchingModel({ modelKey, existingMatchingModel, remoteModelId }) {
	if (!existingMatchingModel) {
		return true;
	}
	return existingMatchingModel === modelKey || existingMatchingModel === remoteModelId;
}

function resolveEntryRemoteModel(entry, remoteModels, sourceFile) {
	const matchingModel = getStringPropertyValue(entry.objectNode, "matchingModel", sourceFile);
	const remoteModel =
		remoteModels[entry.modelKey] ?? (matchingModel ? remoteModels[matchingModel] : undefined);
	const remoteModelId =
		typeof remoteModel?.id === "string" ? remoteModel.id : (matchingModel ?? entry.modelKey);

	return { matchingModel, remoteModel, remoteModelId };
}

function isCurrentAliasModelId(modelId) {
	return CURRENT_ALIAS_SUFFIX_REGEX.test(modelId);
}

function getEntryModelIds(entry, sourceFile) {
	const matchingModel = getStringPropertyValue(entry.objectNode, "matchingModel", sourceFile);
	return matchingModel ? [entry.modelKey, matchingModel] : [entry.modelKey];
}

function shouldProtectCurrentAlias(provider, modelId) {
	return isCurrentAliasModelId(modelId);
}

function getCurrentAliasFamilies(entries, sourceFile, provider) {
	const families = new Set();
	for (const entry of entries) {
		for (const modelId of getEntryModelIds(entry, sourceFile)) {
			if (shouldProtectCurrentAlias(provider, modelId)) {
				families.add(modelFamilyKey(modelId, provider));
			}
		}
	}
	return families;
}

function isProtectedCurrentAliasEntry(entry, provider) {
	return shouldProtectCurrentAlias(provider, entry.modelKey);
}

function remoteModelIsRepresentedByCurrentAlias(remoteModelId, currentAliasFamilies) {
	for (const currentAliasFamily of currentAliasFamilies) {
		if (
			remoteModelId === currentAliasFamily ||
			remoteModelId.startsWith(`${currentAliasFamily}-`)
		) {
			return true;
		}
	}
	return false;
}

function isStaleUnmatchedFamilyEntry({
	remoteModel,
	remoteModelId,
	remoteModelFamilies,
	provider,
	currentAliasFamilies,
}) {
	if (remoteModel && typeof remoteModel === "object") {
		return false;
	}
	const family = modelFamilyKey(remoteModelId, provider);
	if (currentAliasFamilies.has(family)) {
		return false;
	}
	return remoteModelFamilies.has(family);
}

function findDuplicateRemoteModelEntryNodes(entries, remoteModels, sourceFile) {
	const preferredEntriesByResolvedModelId = new Map();
	const duplicateEntryNodes = new Set();

	for (const entry of entries) {
		const { remoteModelId } = resolveEntryRemoteModel(entry, remoteModels, sourceFile);

		const existingEntry = preferredEntriesByResolvedModelId.get(remoteModelId);
		if (!existingEntry) {
			preferredEntriesByResolvedModelId.set(remoteModelId, entry);
			continue;
		}

		if (entry.modelKey === remoteModelId && existingEntry.modelKey !== remoteModelId) {
			duplicateEntryNodes.add(existingEntry.entryNode);
			preferredEntriesByResolvedModelId.set(remoteModelId, entry);
			continue;
		}

		duplicateEntryNodes.add(entry.entryNode);
	}

	return duplicateEntryNodes;
}

function getEntryIndentFromNodes(fileText, nodes, fallbackIndentBasePosition) {
	if (nodes.length > 0) {
		return getIndentAtPosition(fileText, nodes[0].getStart());
	}
	const baseIndent = getIndentAtPosition(fileText, fallbackIndentBasePosition);
	return `${baseIndent}\t`;
}

function remoteModelsFromProvider(remoteProviderConfig) {
	if (!remoteProviderConfig || typeof remoteProviderConfig !== "object") {
		return null;
	}
	if (!remoteProviderConfig.models || typeof remoteProviderConfig.models !== "object") {
		return null;
	}
	return remoteProviderConfig.models;
}

async function inspectModelFile({ filePath, remoteProviders, selectedProviders }) {
	const originalText = await fs.readFile(filePath, "utf8");
	const sourceFile = ts.createSourceFile(
		filePath,
		originalText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);

	const declaration = findModelConfigDeclaration(sourceFile);
	if (!declaration) {
		return {
			filePath,
			status: "skipped",
			reason: "no-model-config-declaration",
		};
	}

	let localProvider = null;
	let entries = [];
	let containerNode = null;
	let containerElements = [];

	if (declaration.style === "array") {
		localProvider = findProviderFromConstant(sourceFile);
		entries = extractArrayEntries(declaration.arrayNode, sourceFile);
		containerNode = declaration.arrayNode;
		containerElements = declaration.arrayNode.elements;
	} else {
		entries = extractObjectEntries(declaration.objectNode, sourceFile);
		localProvider = inferProviderFromObjectEntries(entries, sourceFile);
		containerNode = declaration.objectNode;
		containerElements = declaration.objectNode.properties;
	}

	if (!localProvider) {
		return {
			filePath,
			status: "skipped",
			reason: "provider-not-found",
		};
	}

	const remoteProviderId = PROVIDER_ALIASES[localProvider] ?? localProvider;
	if (!shouldProcessProvider(localProvider, remoteProviderId, selectedProviders)) {
		return {
			filePath,
			status: "skipped",
			reason: "provider-filtered",
			localProvider,
			remoteProviderId,
		};
	}

	const remoteProviderConfig = remoteProviders[remoteProviderId];
	const remoteProviderDeprecated = hasDeprecatedStatus(remoteProviderConfig);
	const remoteModels = remoteModelsFromProvider(remoteProviderConfig);
	const providerModelStatus = buildProviderModelStatus(remoteModels ?? {}, remoteProviderId);
	const remoteModelFamilies = buildProviderModelFamilies(remoteModels ?? {}, remoteProviderId);
	if (!remoteModels && !remoteProviderDeprecated) {
		return {
			filePath,
			status: "skipped",
			reason: "remote-provider-missing",
			localProvider,
			remoteProviderId,
		};
	}

	const representedRemoteModelIds = new Set();
	for (const entry of entries) {
		if (remoteModels && hasOwn(remoteModels, entry.modelKey)) {
			representedRemoteModelIds.add(entry.modelKey);
		}
		const matchingModel = getStringPropertyValue(entry.objectNode, "matchingModel", sourceFile);
		if (matchingModel && remoteModels && hasOwn(remoteModels, matchingModel)) {
			representedRemoteModelIds.add(matchingModel);
		}
		for (const overrideModelId of getReasoningOverrideModelIds(entry.objectNode, sourceFile)) {
			if (remoteModels && hasOwn(remoteModels, overrideModelId)) {
				representedRemoteModelIds.add(overrideModelId);
			}
		}
	}

	return {
		filePath,
		status: "processable",
		originalText,
		sourceFile,
		declaration,
		localProvider,
		remoteProviderId,
		remoteProviderDeprecated,
		remoteModels: remoteModels ?? {},
		providerModelStatus,
		remoteModelFamilies,
		entries,
		containerNode,
		containerElements,
		representedRemoteModelIds,
	};
}

async function processFile({
	filePath,
	remoteProviders,
	artificialAnalysisLookup,
	write,
	selectedProviders,
	verbose,
	providerRepresentedRemoteModelIds,
	allowAddingMissingModels,
}) {
	const inspection = await inspectModelFile({ filePath, remoteProviders, selectedProviders });
	if (inspection.status !== "processable") {
		return inspection;
	}

	const {
		originalText,
		sourceFile,
		declaration,
		localProvider,
		remoteProviderId,
		remoteProviderDeprecated,
		remoteModels,
		providerModelStatus,
		remoteModelFamilies,
		entries,
		containerNode,
		containerElements,
	} = inspection;

	const patches = [];
	let updatedExisting = 0;
	let updatedArtificialAnalysis = 0;
	let removedDeprecatedModels = 0;
	let removedDuplicateModels = 0;
	const duplicateEntryNodes = findDuplicateRemoteModelEntryNodes(entries, remoteModels, sourceFile);
	const currentAliasFamilies = getCurrentAliasFamilies(entries, sourceFile, remoteProviderId);

	for (const entry of entries) {
		const { matchingModel, remoteModel, remoteModelId } = resolveEntryRemoteModel(
			entry,
			remoteModels,
			sourceFile,
		);

		if (duplicateEntryNodes.has(entry.entryNode)) {
			removedDuplicateModels += 1;
			patches.push(buildRemoveEntryPatch(originalText, entry.entryNode, sourceFile));
			continue;
		}

		const isOutdatedModel = providerModelStatus.outdatedModelIds.has(remoteModelId);
		const shouldRemoveBecauseNotLatest =
			providerModelStatus.latestModelIds.size > 0 &&
			!providerModelStatus.latestModelIds.has(remoteModelId) &&
			!isProtectedCurrentAliasEntry(entry, remoteProviderId);
		if (
			remoteProviderDeprecated ||
			hasDeprecatedStatus(remoteModel) ||
			isOutdatedModel ||
			shouldRemoveBecauseNotLatest ||
			isStaleUnmatchedFamilyEntry({
				remoteModel,
				remoteModelId,
				remoteModelFamilies,
				provider: remoteProviderId,
				currentAliasFamilies,
			})
		) {
			removedDeprecatedModels += 1;
			patches.push(buildRemoveEntryPatch(originalText, entry.entryNode, sourceFile));
			continue;
		}

		if (!remoteModel || typeof remoteModel !== "object") {
			continue;
		}

		const values = buildUpdateValues(remoteModel, {
			modelKey: remoteModelId,
			existingMatchingModel: matchingModel,
			allowMatchingModelUpdate: shouldUpdateMatchingModel({
				modelKey: entry.modelKey,
				existingMatchingModel: matchingModel,
				remoteModelId,
			}),
			isNewEntry: false,
			includeProvider: false,
			provider: localProvider,
		});
		const artificialAnalysisModel = findArtificialAnalysisModel({
			lookup: artificialAnalysisLookup,
			entry,
			remoteModel,
			remoteModelId,
			sourceFile,
		});
		if (artificialAnalysisModel) {
			Object.assign(
				values,
				buildArtificialAnalysisUpdateValues(
					artificialAnalysisModel,
					entry.objectNode,
					sourceFile,
					values,
				),
			);
			updatedArtificialAnalysis += 1;
		}

		const entryPatches = buildObjectPatches({
			fileText: originalText,
			sourceFile,
			objectNode: entry.objectNode,
			values,
		});

		if (entryPatches.length > 0) {
			updatedExisting += 1;
			patches.push(...entryPatches);
		}
	}

	const representedRemoteModelIds =
		providerRepresentedRemoteModelIds ?? inspection.representedRemoteModelIds;

	const missingRemoteModelIds =
		allowAddingMissingModels && !remoteProviderDeprecated
			? Object.keys(remoteModels)
					.filter((remoteModelId) => !representedRemoteModelIds.has(remoteModelId))
					.filter((remoteModelId) => !isIgnoredRemoteModelId(remoteProviderId, remoteModelId))
					.filter((remoteModelId) => {
						return (
							!remoteModelIsRepresentedByCurrentAlias(remoteModelId, currentAliasFamilies) ||
							shouldProtectCurrentAlias(remoteProviderId, remoteModelId)
						);
					})
					.filter((remoteModelId) => !hasDeprecatedStatus(remoteModels[remoteModelId]))
					.filter((remoteModelId) => !providerModelStatus.outdatedModelIds.has(remoteModelId))
					.filter((remoteModelId) => {
						if (providerModelStatus.latestModelIds.size === 0) {
							return true;
						}
						return providerModelStatus.latestModelIds.has(remoteModelId);
					})
					.sort((left, right) => left.localeCompare(right))
			: [];

	const entryIndent = getEntryIndentFromNodes(
		originalText,
		containerElements,
		containerNode.getStart(sourceFile),
	);

	const newEntries = missingRemoteModelIds.map((remoteModelId) => {
		const remoteModel = remoteModels[remoteModelId];
		const values = buildUpdateValues(remoteModel, {
			modelKey: remoteModelId,
			existingMatchingModel: undefined,
			allowMatchingModelUpdate: true,
			isNewEntry: true,
			includeProvider: declaration.style === "object",
			provider: localProvider,
		});
		const analysisKeys = new Set();
		addModelLookupKeys(analysisKeys, remoteModelId);
		if (remoteModel && typeof remoteModel === "object") {
			addModelLookupKeys(analysisKeys, remoteModel.id);
			addModelLookupKeys(analysisKeys, remoteModel.name);
		}
		for (const key of analysisKeys) {
			const artificialAnalysisModel = artificialAnalysisLookup.get(key);
			if (artificialAnalysisModel) {
				Object.assign(
					values,
					buildArtificialAnalysisUpdateValues(
						artificialAnalysisModel,
						undefined,
						undefined,
						values,
					),
				);
				updatedArtificialAnalysis += 1;
				break;
			}
		}

		return declaration.style === "array"
			? formatNewArrayEntry(remoteModelId, values, entryIndent)
			: formatNewObjectEntry(remoteModelId, values, entryIndent);
	});

	if (newEntries.length > 0) {
		const closeTokenPosition = containerNode.end - 1;
		const insertionPoint = getLineStart(originalText, closeTokenPosition);
		patches.push({
			start: insertionPoint,
			end: insertionPoint,
			text: `${newEntries.join("\n\n")}\n`,
		});
	}

	if (patches.length === 0) {
		return {
			filePath,
			status: "unchanged",
			localProvider,
			remoteProviderId,
			updatedExisting: 0,
			updatedArtificialAnalysis: 0,
			addedModels: 0,
			removedDeprecatedModels: 0,
			removedDuplicateModels: 0,
		};
	}

	const nextText = applyPatches(originalText, patches);
	if (write) {
		await fs.writeFile(filePath, nextText, "utf8");
	}

	if (verbose) {
		const modeLabel = write ? "wrote" : "dry-run";
		console.log(
			`[${modeLabel}] ${path.relative(API_ROOT, filePath)} (${localProvider} -> ${remoteProviderId}) updated=${updatedExisting} added=${newEntries.length} removedDeprecated=${removedDeprecatedModels} removedDuplicates=${removedDuplicateModels}`,
		);
	}

	return {
		filePath,
		status: "changed",
		localProvider,
		remoteProviderId,
		updatedExisting,
		updatedArtificialAnalysis,
		addedModels: newEntries.length,
		removedDeprecatedModels,
		removedDuplicateModels,
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const remoteProviders = await fetchApiData(options.apiUrl);
	const artificialAnalysisModels = await fetchArtificialAnalysisData({
		apiUrl: options.polychatApiBaseUrl,
		apiKey: options.polychatApiKey,
	});
	const artificialAnalysisLookup = buildArtificialAnalysisLookup(artificialAnalysisModels);
	const files = (await listTsFiles(options.modelsDir))
		.filter((filePath) => path.basename(filePath) !== "index.ts")
		.sort((left, right) => left.localeCompare(right));

	const inspections = await Promise.all(
		files.map((filePath) =>
			inspectModelFile({
				filePath,
				remoteProviders,
				selectedProviders: options.providers,
			}),
		),
	);
	const providerRepresentedRemoteModelIds = new Map();
	const providerFileCounts = new Map();

	for (const inspection of inspections) {
		if (inspection.status !== "processable") {
			continue;
		}

		providerFileCounts.set(
			inspection.remoteProviderId,
			(providerFileCounts.get(inspection.remoteProviderId) ?? 0) + 1,
		);

		let representedRemoteModelIds = providerRepresentedRemoteModelIds.get(
			inspection.remoteProviderId,
		);
		if (!representedRemoteModelIds) {
			representedRemoteModelIds = new Set();
			providerRepresentedRemoteModelIds.set(inspection.remoteProviderId, representedRemoteModelIds);
		}

		for (const remoteModelId of inspection.representedRemoteModelIds) {
			representedRemoteModelIds.add(remoteModelId);
		}
	}

	const reports = [];
	for (const filePath of files) {
		const inspection = inspections.find((candidate) => candidate.filePath === filePath);
		const providerFileCount =
			inspection?.status === "processable"
				? (providerFileCounts.get(inspection.remoteProviderId) ?? 1)
				: 1;
		const report = await processFile({
			filePath,
			remoteProviders,
			artificialAnalysisLookup,
			write: options.write,
			selectedProviders: options.providers,
			verbose: options.verbose,
			providerRepresentedRemoteModelIds:
				inspection?.status === "processable"
					? providerRepresentedRemoteModelIds.get(inspection.remoteProviderId)
					: undefined,
			allowAddingMissingModels: providerFileCount === 1,
		});
		reports.push(report);
	}

	const changed = reports.filter((report) => report.status === "changed");
	const unchanged = reports.filter((report) => report.status === "unchanged");
	const skipped = reports.filter((report) => report.status === "skipped");

	const totalUpdatedExisting = changed.reduce((total, report) => {
		return total + (report.updatedExisting ?? 0);
	}, 0);

	const totalAddedModels = changed.reduce((total, report) => {
		return total + (report.addedModels ?? 0);
	}, 0);

	const totalUpdatedArtificialAnalysis = changed.reduce((total, report) => {
		return total + (report.updatedArtificialAnalysis ?? 0);
	}, 0);

	const totalRemovedDeprecatedModels = changed.reduce((total, report) => {
		return total + (report.removedDeprecatedModels ?? 0);
	}, 0);

	const totalRemovedDuplicateModels = changed.reduce((total, report) => {
		return total + (report.removedDuplicateModels ?? 0);
	}, 0);

	console.log(
		`Processed ${reports.length} files (${changed.length} changed, ${unchanged.length} unchanged, ${skipped.length} skipped).`,
	);
	console.log(
		`Updated existing models: ${totalUpdatedExisting}. Added new models: ${totalAddedModels}. Removed deprecated models: ${totalRemovedDeprecatedModels}. Removed duplicate models: ${totalRemovedDuplicateModels}.`,
	);
	if (options.polychatApiKey) {
		console.log(
			`Synced Artificial Analysis data for ${totalUpdatedArtificialAnalysis} models from ${artificialAnalysisModels.length} cached records.`,
		);
	}

	const stats = {
		processedFiles: reports.length,
		changedFiles: changed.length,
		unchangedFiles: unchanged.length,
		skippedFiles: skipped.length,
		updatedExistingModels: totalUpdatedExisting,
		updatedArtificialAnalysisModels: totalUpdatedArtificialAnalysis,
		addedModels: totalAddedModels,
		removedDeprecatedModels: totalRemovedDeprecatedModels,
		removedDuplicateModels: totalRemovedDuplicateModels,
	};

	if (!options.write) {
		console.log("Dry run only. Re-run with --write to apply changes.");
	}

	const splitProviders = [...providerFileCounts.entries()]
		.filter(([, fileCount]) => fileCount > 1)
		.map(([remoteProviderId]) => remoteProviderId)
		.sort((left, right) => left.localeCompare(right));

	if (splitProviders.length > 0) {
		console.log(`Skipped adding missing models for split providers: ${splitProviders.join(", ")}`);
	}

	const skippedProviders = skipped
		.filter((report) => report.reason === "remote-provider-missing")
		.map((report) => `${report.localProvider} -> ${report.remoteProviderId}`);

	if (skippedProviders.length > 0) {
		const uniqueSkippedProviders = [...new Set(skippedProviders)].sort((a, b) =>
			a.localeCompare(b),
		);
		console.log(`Providers without models.dev mapping: ${uniqueSkippedProviders.join(", ")}`);
	}

	if (options.triggerAnalysisTask) {
		await triggerAnalysisTask(options, stats);
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`sync-models-dev failed: ${message}`);
	process.exitCode = 1;
});
