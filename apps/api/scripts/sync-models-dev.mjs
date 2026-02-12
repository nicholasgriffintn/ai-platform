#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const API_URL_DEFAULT = "https://models.dev/api.json";

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
	"reasoningConfig",
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
  --help, -h              Show this help
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
	return (node.modifiers ?? []).some(
		(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
	);
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
					declaration.initializer.expression.getText(sourceFile) ===
						"createModelConfigObject" &&
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
			(ts.isStringLiteral(node.initializer) ||
				ts.isNoSubstitutionTemplateLiteral(node.initializer))
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
			objectNode: property.initializer,
		});
	}

	return entries;
}

function inferProviderFromObjectEntries(entries, sourceFile) {
	for (const entry of entries) {
		const provider = getStringPropertyValue(
			entry.objectNode,
			"provider",
			sourceFile,
		);
		if (provider) {
			return provider;
		}
	}
	return null;
}

function hasOwn(objectValue, key) {
	return Object.prototype.hasOwnProperty.call(objectValue, key);
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

function normalizeModalities(
	modalities,
	{ defaultToText } = { defaultToText: false },
) {
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
	const remoteId =
		typeof remoteModel.id === "string" ? remoteModel.id : modelKey;

	if (typeof remoteModel.name === "string" && remoteModel.name.length > 0) {
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
	if (modalities) {
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

	if (hasOwn(remoteModel, "reasoning")) {
		values.reasoningConfig = {
			enabled: Boolean(remoteModel.reasoning),
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

		const propertyIndent = getIndentAtPosition(
			fileText,
			property.getStart(sourceFile),
		);
		const replacementText = formatValue(nextValue, propertyIndent);
		patches.push({
			start: property.initializer.getStart(sourceFile),
			end: property.initializer.end,
			text: replacementText,
		});
	}

	if (missingFields.length > 0) {
		const objectIndent = getIndentAtPosition(
			fileText,
			objectNode.getStart(sourceFile),
		);
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
		nextText =
			nextText.slice(0, patch.start) + patch.text + nextText.slice(patch.end);
	}

	return nextText;
}

function shouldProcessProvider(
	localProvider,
	remoteProvider,
	selectedProviders,
) {
	if (selectedProviders.size === 0) {
		return true;
	}
	return (
		selectedProviders.has(localProvider) ||
		selectedProviders.has(remoteProvider)
	);
}

function shouldUpdateMatchingModel({
	modelKey,
	existingMatchingModel,
	remoteModelId,
}) {
	if (!existingMatchingModel) {
		return true;
	}
	return (
		existingMatchingModel === modelKey ||
		existingMatchingModel === remoteModelId
	);
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
	if (
		!remoteProviderConfig.models ||
		typeof remoteProviderConfig.models !== "object"
	) {
		return null;
	}
	return remoteProviderConfig.models;
}

async function processFile({
	filePath,
	remoteProviders,
	write,
	selectedProviders,
	verbose,
}) {
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
	if (
		!shouldProcessProvider(localProvider, remoteProviderId, selectedProviders)
	) {
		return {
			filePath,
			status: "skipped",
			reason: "provider-filtered",
			localProvider,
			remoteProviderId,
		};
	}

	const remoteModels = remoteModelsFromProvider(
		remoteProviders[remoteProviderId],
	);
	if (!remoteModels) {
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
		if (hasOwn(remoteModels, entry.modelKey)) {
			representedRemoteModelIds.add(entry.modelKey);
		}
		const matchingModel = getStringPropertyValue(
			entry.objectNode,
			"matchingModel",
			sourceFile,
		);
		if (matchingModel && hasOwn(remoteModels, matchingModel)) {
			representedRemoteModelIds.add(matchingModel);
		}
	}

	const patches = [];
	let updatedExisting = 0;

	for (const entry of entries) {
		const matchingModel = getStringPropertyValue(
			entry.objectNode,
			"matchingModel",
			sourceFile,
		);
		const remoteModel =
			remoteModels[entry.modelKey] ??
			(matchingModel ? remoteModels[matchingModel] : undefined);

		if (!remoteModel || typeof remoteModel !== "object") {
			continue;
		}

		const remoteModelId =
			typeof remoteModel.id === "string" ? remoteModel.id : entry.modelKey;
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

	const missingRemoteModelIds = Object.keys(remoteModels)
		.filter((remoteModelId) => !representedRemoteModelIds.has(remoteModelId))
		.sort((left, right) => left.localeCompare(right));

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
			addedModels: 0,
		};
	}

	const nextText = applyPatches(originalText, patches);
	if (write) {
		await fs.writeFile(filePath, nextText, "utf8");
	}

	if (verbose) {
		const modeLabel = write ? "wrote" : "dry-run";
		console.log(
			`[${modeLabel}] ${path.relative(API_ROOT, filePath)} (${localProvider} -> ${remoteProviderId}) updated=${updatedExisting} added=${newEntries.length}`,
		);
	}

	return {
		filePath,
		status: "changed",
		localProvider,
		remoteProviderId,
		updatedExisting,
		addedModels: newEntries.length,
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const remoteProviders = await fetchApiData(options.apiUrl);
	const files = (await listTsFiles(options.modelsDir))
		.filter((filePath) => path.basename(filePath) !== "index.ts")
		.sort((left, right) => left.localeCompare(right));

	const reports = [];
	for (const filePath of files) {
		const report = await processFile({
			filePath,
			remoteProviders,
			write: options.write,
			selectedProviders: options.providers,
			verbose: options.verbose,
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

	console.log(
		`Processed ${reports.length} files (${changed.length} changed, ${unchanged.length} unchanged, ${skipped.length} skipped).`,
	);
	console.log(
		`Updated existing models: ${totalUpdatedExisting}. Added new models: ${totalAddedModels}.`,
	);

	if (!options.write) {
		console.log("Dry run only. Re-run with --write to apply changes.");
	}

	const skippedProviders = skipped
		.filter((report) => report.reason === "remote-provider-missing")
		.map((report) => `${report.localProvider} -> ${report.remoteProviderId}`);

	if (skippedProviders.length > 0) {
		const uniqueSkippedProviders = [...new Set(skippedProviders)].sort((a, b) =>
			a.localeCompare(b),
		);
		console.log(
			`Providers without models.dev mapping: ${uniqueSkippedProviders.join(", ")}`,
		);
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`sync-models-dev failed: ${message}`);
	process.exitCode = 1;
});
