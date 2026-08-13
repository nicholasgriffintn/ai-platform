import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export type RecipeTriggerConfigurationValue = string | boolean;

export interface RecipeTriggerConfigurationField {
	key: string;
	label: string;
	description?: string;
	type: "text" | "number" | "boolean" | "select";
	required: boolean;
	options?: string[];
	defaultValue: RecipeTriggerConfigurationValue;
}

interface RecipeTriggerConfigurationFieldsResult {
	fields: RecipeTriggerConfigurationField[];
	unsupportedRequiredLabels: string[];
}

export function formatRecipeTriggerIdentifier(value: string): string {
	const words = value
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim()
		.toLowerCase();
	return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Event";
}

function readFieldLabel(key: string, schema: Record<string, unknown>): string {
	return typeof schema.title === "string" && schema.title.trim()
		? schema.title.trim()
		: formatRecipeTriggerIdentifier(key);
}

function readStringOptions(schema: Record<string, unknown>): string[] | undefined {
	if (!Array.isArray(schema.enum)) return undefined;
	const options = schema.enum.filter((option): option is string => typeof option === "string");
	return options.length === schema.enum.length && options.length > 0 ? options : undefined;
}

function toSupportedField(
	key: string,
	schema: Record<string, unknown>,
	required: boolean,
): RecipeTriggerConfigurationField | null {
	const label = readFieldLabel(key, schema);
	const description =
		typeof schema.description === "string" && schema.description.trim()
			? schema.description.trim()
			: undefined;
	const common = { key, label, description, required };
	if (schema.type === "boolean") {
		return { ...common, type: "boolean", defaultValue: schema.default === true };
	}
	if (schema.type === "number" || schema.type === "integer") {
		return {
			...common,
			type: "number",
			defaultValue: typeof schema.default === "number" ? String(schema.default) : "",
		};
	}
	if (schema.type === "string" || schema.type === undefined) {
		const options = readStringOptions(schema);
		return {
			...common,
			type: options ? "select" : "text",
			options,
			defaultValue:
				typeof schema.default === "string" ? schema.default : options?.[0] ? options[0] : "",
		};
	}
	return null;
}

export function getRecipeTriggerConfigurationFields(
	schema: Record<string, unknown>,
): RecipeTriggerConfigurationFieldsResult {
	const properties = isRecord(schema.properties) ? schema.properties : {};
	const requiredKeys = new Set(
		Array.isArray(schema.required)
			? schema.required.filter((key): key is string => typeof key === "string")
			: [],
	);
	const fields: RecipeTriggerConfigurationField[] = [];
	const unsupportedRequiredLabels: string[] = [];

	for (const [key, value] of Object.entries(properties)) {
		if (!key.trim() || !isRecord(value)) continue;
		const field = toSupportedField(key, value, requiredKeys.has(key));
		if (field) {
			fields.push(field);
		} else if (requiredKeys.has(key)) {
			unsupportedRequiredLabels.push(readFieldLabel(key, value));
		}
	}

	return { fields, unsupportedRequiredLabels };
}

function joinLabels(labels: string[]): string {
	if (labels.length < 2) return labels[0] ?? "";
	if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
	return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

export function buildRecipeTriggerConfiguration(
	fields: RecipeTriggerConfigurationField[],
	values: Record<string, RecipeTriggerConfigurationValue>,
): { configuration: Record<string, unknown>; error?: string } {
	const configuration: Record<string, unknown> = {};
	const missing: string[] = [];
	const invalidNumbers: string[] = [];

	for (const field of fields) {
		const value = values[field.key] ?? field.defaultValue;
		if (field.type === "boolean") {
			configuration[field.key] = value === true;
			continue;
		}
		const text = typeof value === "string" ? value.trim() : "";
		if (!text) {
			if (field.required) missing.push(field.label);
			continue;
		}
		if (field.type === "number") {
			const number = Number(text);
			if (!Number.isFinite(number)) {
				invalidNumbers.push(field.label);
				continue;
			}
			configuration[field.key] = number;
			continue;
		}
		configuration[field.key] = text;
	}

	const errors = [
		missing.length > 0 ? `Complete ${joinLabels(missing)}` : "",
		invalidNumbers.length > 0 ? `enter a valid ${joinLabels(invalidNumbers)}` : "",
	].filter(Boolean);
	if (errors.length > 0) {
		return {
			configuration: {},
			error: `${errors.join(" and ")}.`,
		};
	}
	return { configuration };
}
