import ts from "typescript";
import { UNPARSEABLE, UPDATE_FIELD_ORDER } from "./constants.mjs";
import {
	getIndentAtPosition,
	getLineStart,
	getPropertyName,
	parseLiteralValue,
} from "./source-model-config.mjs";
import { hasOwn } from "./value-utils.mjs";

export function formatNumber(value) {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return "0";
	}
	if (Number.isInteger(value)) {
		return String(value);
	}
	const formatted = value.toFixed(10).replace(/\.?0+$/, "");
	return formatted.length > 0 ? formatted : "0";
}

export function formatValue(value, indent) {
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

export function deepEqual(left, right) {
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

export function buildObjectPatches({ fileText, sourceFile, objectNode, values }) {
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

export function orderedEntries(values) {
	const entries = [];
	for (const fieldName of UPDATE_FIELD_ORDER) {
		if (hasOwn(values, fieldName) && values[fieldName] !== undefined) {
			entries.push([fieldName, values[fieldName]]);
		}
	}
	return entries;
}

export function formatNewObjectEntry(modelId, values, entryIndent) {
	const propertyIndent = `${entryIndent}\t`;
	const lines = orderedEntries(values).map(([fieldName, fieldValue]) => {
		return `${propertyIndent}${fieldName}: ${formatValue(fieldValue, propertyIndent)},`;
	});

	return `${entryIndent}${JSON.stringify(modelId)}: {\n${lines.join("\n")}\n${entryIndent}},`;
}

export function formatNewArrayEntry(modelId, values, entryIndent) {
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

export function applyPatches(text, patches) {
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

export function buildRemoveEntryPatch(fileText, entryNode, sourceFile) {
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
