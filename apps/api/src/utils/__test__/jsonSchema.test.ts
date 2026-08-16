import { describe, expect, it } from "vitest";
import z from "zod/v4";

import { jsonSchemaToZod } from "../jsonSchema";

describe("jsonSchemaToZod", () => {
	it("preserves nested Composio constraints and closed objects", () => {
		const schema = jsonSchemaToZod({
			type: "object",
			required: ["order"],
			additionalProperties: false,
			properties: {
				order: {
					type: "object",
					required: ["marketSlug", "quantity"],
					additionalProperties: false,
					properties: {
						marketSlug: { type: "string", minLength: 1 },
						quantity: { type: "number", exclusiveMinimum: 0 },
					},
				},
			},
		});

		expect(schema.safeParse({ order: { marketSlug: "market", quantity: 1 } }).success).toBe(true);
		expect(schema.safeParse({ order: { marketSlug: "", quantity: 0 } }).success).toBe(false);
		expect(
			schema.safeParse({ order: { marketSlug: "market", quantity: 1, ignored: true } }).success,
		).toBe(false);
	});

	it("supports numeric enums, nullable unions, formats, and array bounds", () => {
		const schema = jsonSchemaToZod({
			type: "object",
			required: ["mode", "when", "values"],
			properties: {
				mode: { type: "integer", enum: [1, 2] },
				when: { anyOf: [{ type: "string", format: "date" }, { type: "null" }] },
				values: { type: "array", minItems: 1, maxItems: 2, items: { type: "string" } },
			},
		});

		expect(schema.safeParse({ mode: 2, when: null, values: ["one"] }).success).toBe(true);
		expect(schema.safeParse({ mode: 3, when: "12/08/2026", values: [] }).success).toBe(false);
	});

	it("serialises large enums without recursively nested unions", () => {
		const providers = Array.from({ length: 150 }, (_, index) => `provider-${index}`);
		const schema = jsonSchemaToZod({
			type: "object",
			required: ["provider"],
			properties: {
				provider: { type: "string", enum: providers },
			},
		});

		const jsonSchema = z.toJSONSchema(schema);
		const providerSchema = jsonSchema.properties?.provider;

		expect(providerSchema).toMatchObject({ enum: providers });
		expect(providerSchema).not.toHaveProperty("anyOf");
		expect(schema.safeParse({ provider: "provider-149" }).success).toBe(true);
		expect(schema.safeParse({ provider: "missing" }).success).toBe(false);
	});

	it("supports root-level required alternatives", () => {
		const schema = jsonSchemaToZod({
			type: "object",
			properties: {
				recipeId: { type: "string" },
				query: { type: "string" },
				input: { type: "string" },
			},
			anyOf: [{ required: ["recipeId"] }, { required: ["query"] }],
			additionalProperties: false,
		});

		expect(schema.safeParse({}).success).toBe(false);
		expect(schema.safeParse({ recipeId: "recipe-1" }).success).toBe(true);
		expect(schema.safeParse({ query: "run my alert" }).success).toBe(true);
		expect(z.toJSONSchema(schema).anyOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ required: ["recipeId"], additionalProperties: false }),
				expect.objectContaining({ required: ["query"], additionalProperties: false }),
			]),
		);
	});
});
