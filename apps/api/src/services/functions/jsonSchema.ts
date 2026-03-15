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
	multipleOf?: number;
	enum?: string[];
	properties?: Record<string, JsonSchemaProperty>;
	required?: readonly string[];
	items?: JsonSchemaProperty;
};

type JsonObjectSchema = {
	type: "object";
	properties: Record<string, JsonSchemaProperty>;
	required?: readonly string[];
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

function applyNumericRules(
	schema: z.ZodNumber,
	property: JsonSchemaProperty,
): z.ZodNumber {
	let next = schema;

	if (typeof property.minimum === "number") {
		next = next.min(property.minimum);
	}

	if (typeof property.maximum === "number") {
		next = next.max(property.maximum);
	}

	if (typeof property.multipleOf === "number") {
		next = next.multipleOf(property.multipleOf);
	}

	return next;
}

function toZodSchema(property: JsonSchemaProperty): z.ZodTypeAny {
	switch (property.type) {
		case "string": {
			if (property.enum?.length) {
				const enumValues = property.enum as [string, ...string[]];
				return applyDescription(z.enum(enumValues), property.description);
			}

			let schema: z.ZodTypeAny = z.string();
			if (property.pattern) {
				const regex = safePattern(property.pattern);
				if (regex) {
					schema = (schema as z.ZodString).regex(regex);
				}
			}

			return applyDescription(schema, property.description);
		}
		case "number":
			return applyDescription(
				applyNumericRules(z.number(), property),
				property.description,
			);
		case "integer":
			return applyDescription(
				applyNumericRules(z.number().int(), property),
				property.description,
			);
		case "boolean":
			return applyDescription(z.boolean(), property.description);
		case "array": {
			const itemSchema = property.items
				? toZodSchema(property.items)
				: z.unknown();
			return applyDescription(z.array(itemSchema), property.description);
		}
		case "object":
			return applyDescription(
				jsonSchemaToZod({
					type: "object",
					properties: property.properties ?? {},
					required: property.required,
				}),
				property.description,
			);
		default:
			if (property.properties) {
				return applyDescription(
					jsonSchemaToZod({
						type: "object",
						properties: property.properties,
						required: property.required,
					}),
					property.description,
				);
			}
			return applyDescription(z.unknown(), property.description);
	}
}

export function jsonSchemaToZod(
	parameters: JsonObjectSchema,
	strict = false,
): z.ZodTypeAny {
	const requiredKeys = new Set(parameters.required ?? []);
	const shape: Record<string, z.ZodTypeAny> = {};

	for (const [key, property] of Object.entries(parameters.properties ?? {})) {
		const propertySchema = toZodSchema(property);
		shape[key] = requiredKeys.has(key)
			? propertySchema
			: propertySchema.optional();
	}

	const schema = z.object(shape);
	return strict ? schema.strict() : schema.passthrough();
}
