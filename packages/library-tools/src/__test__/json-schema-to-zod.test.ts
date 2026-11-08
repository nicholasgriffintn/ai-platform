import { describe, expect, it } from "vitest";
import z from "zod/v4";

import { jsonSchemaToZod } from "../json-schema-to-zod.js";

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

  it("rejects an invalid regex pattern instead of silently dropping it", () => {
    expect(() =>
      jsonSchemaToZod({
        type: "object",
        properties: { slug: { type: "string", pattern: "[unclosed" } },
      }),
    ).toThrowError(
      expect.objectContaining({ name: "ToolError", code: "invalid_schema", pattern: "[unclosed" }),
    );
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
