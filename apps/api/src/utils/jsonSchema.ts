import z from "zod/v4";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/functions/jsonSchema" });

type JsonSchemaProperty = {
	type?: string;
	description?: string;
	pattern?: string;
	default?: unknown;
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	multipleOf?: number;
	minLength?: number;
	maxLength?: number;
	minItems?: number;
	maxItems?: number;
	format?: string;
	const?: string | number | boolean | null;
	enum?: Array<string | number>;
	anyOf?: JsonSchemaProperty[];
	properties?: Record<string, JsonSchemaProperty>;
	required?: readonly string[];
	items?: JsonSchemaProperty;
	additionalProperties?: boolean | JsonSchemaProperty;
};

type JsonObjectSchema = {
	type: "object";
	properties: Record<string, JsonSchemaProperty>;
	required?: readonly string[];
	anyOf?: Array<{ required: readonly string[] }>;
	additionalProperties?: boolean | JsonSchemaProperty;
};

function applyDescription<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	description?: string,
): TSchema {
	if (!description) {
		return schema;
	}

	return schema.describe(description) as TSchema;
}

function safePattern(pattern: string): RegExp | null {
	try {
		return new RegExp(pattern);
	} catch (error) {
		logger.warn("Invalid tool parameter regex pattern", {
			pattern,
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		return null;
	}
}

function applyNumericRules(schema: z.ZodNumber, property: JsonSchemaProperty): z.ZodNumber {
	let next = schema;

	if (typeof property.minimum === "number") {
		next = next.min(property.minimum);
	}

	if (typeof property.maximum === "number") {
		next = next.max(property.maximum);
	}

	if (typeof property.exclusiveMinimum === "number") {
		next = next.gt(property.exclusiveMinimum);
	}

	if (typeof property.multipleOf === "number") {
		next = next.multipleOf(property.multipleOf);
	}

	return next;
}

function literalSchema(values: Array<string | number | boolean | null>): z.ZodTypeAny {
	if (values.length === 0) return z.never();
	return z.literal(values);
}

function applyStringRules(schema: z.ZodString, property: JsonSchemaProperty): z.ZodTypeAny {
	let next: z.ZodTypeAny = schema;
	if (typeof property.minLength === "number") next = (next as z.ZodString).min(property.minLength);
	if (typeof property.maxLength === "number") next = (next as z.ZodString).max(property.maxLength);
	if (property.pattern) {
		const regex = safePattern(property.pattern);
		if (regex) next = (next as z.ZodString).regex(regex);
	}
	if (property.format === "date") {
		next = next.refine(
			(value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
			"Invalid date",
		);
	} else if (property.format === "date-time") {
		next = next.refine(
			(value) => typeof value === "string" && Number.isFinite(Date.parse(value)),
			"Invalid date-time",
		);
	} else if (property.format === "uri") {
		next = next.refine((value) => {
			if (typeof value !== "string") return false;
			try {
				new URL(value);
				return true;
			} catch {
				return false;
			}
		}, "Invalid URI");
	}
	return next;
}

function toZodSchema(property: JsonSchemaProperty): z.ZodTypeAny {
	if (property.const !== undefined) {
		return applyDescription(z.literal(property.const), property.description);
	}
	if (property.enum?.length) {
		return applyDescription(literalSchema(property.enum), property.description);
	}
	if (property.anyOf?.length) {
		const [first, ...rest] = property.anyOf.map(toZodSchema);
		const schema = rest.reduce<z.ZodTypeAny>(
			(combined, option) => combined.or(option),
			first ?? z.never(),
		);
		return applyDescription(schema, property.description);
	}

	switch (property.type) {
		case "string": {
			return applyDescription(applyStringRules(z.string(), property), property.description);
		}
		case "number":
			return applyDescription(applyNumericRules(z.number(), property), property.description);
		case "integer":
			return applyDescription(applyNumericRules(z.number().int(), property), property.description);
		case "boolean":
			return applyDescription(z.boolean(), property.description);
		case "array": {
			const itemSchema = property.items ? toZodSchema(property.items) : z.unknown();
			let schema = z.array(itemSchema);
			if (typeof property.minItems === "number") schema = schema.min(property.minItems);
			if (typeof property.maxItems === "number") schema = schema.max(property.maxItems);
			return applyDescription(schema, property.description);
		}
		case "object":
			return applyDescription(
				jsonSchemaToZod({
					type: "object",
					properties: property.properties ?? {},
					required: property.required,
					additionalProperties: property.additionalProperties,
				}),
				property.description,
			);
		case "null":
			return applyDescription(z.null(), property.description);
		default:
			if (property.properties) {
				return applyDescription(
					jsonSchemaToZod({
						type: "object",
						properties: property.properties,
						required: property.required,
						additionalProperties: property.additionalProperties,
					}),
					property.description,
				);
			}
			return applyDescription(z.unknown(), property.description);
	}
}

function objectSchemaToZod(
	parameters: JsonObjectSchema,
	requiredKeys: ReadonlySet<string>,
	strict: boolean,
): z.ZodTypeAny {
	const shape: Record<string, z.ZodTypeAny> = {};

	for (const [key, property] of Object.entries(parameters.properties ?? {})) {
		const propertySchema = toZodSchema(property);
		shape[key] = requiredKeys.has(key) ? propertySchema : propertySchema.optional();
	}

	const schema = z.object(shape);
	if (strict || parameters.additionalProperties === false) return schema.strict();
	if (parameters.additionalProperties && typeof parameters.additionalProperties === "object") {
		return schema.catchall(toZodSchema(parameters.additionalProperties));
	}
	return schema.passthrough();
}

export function jsonSchemaToZod(parameters: JsonObjectSchema, strict = false): z.ZodTypeAny {
	const requiredKeys = new Set(parameters.required ?? []);
	const alternatives = parameters.anyOf;
	const firstAlternative = alternatives?.[0];
	if (!firstAlternative) {
		return objectSchemaToZod(parameters, requiredKeys, strict);
	}
	const firstSchema = objectSchemaToZod(
		parameters,
		new Set([...requiredKeys, ...firstAlternative.required]),
		strict,
	);

	return alternatives.slice(1).reduce<z.ZodTypeAny>((combined, alternative) => {
		const alternativeRequiredKeys = new Set([...requiredKeys, ...alternative.required]);
		return combined.or(objectSchemaToZod(parameters, alternativeRequiredKeys, strict));
	}, firstSchema);
}
