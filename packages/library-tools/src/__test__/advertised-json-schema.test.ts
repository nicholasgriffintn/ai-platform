import { describe, expect, it } from "vitest";
import z from "zod/v4";

import { toToolInputJsonSchema } from "../json-schema.js";

function acceptance(schema: Record<string, unknown>, samples: readonly unknown[]): boolean[] {
  const validator = z.fromJSONSchema(schema);

  return samples.map((sample) => validator.safeParse(sample).success);
}

describe("toToolInputJsonSchema advertised compaction", () => {
  it("accepts and rejects the same inputs as the uncompacted schema", () => {
    const inputSchema = z
      .object({
        mode: z.union([z.literal("fast"), z.literal("slow"), z.literal("fast")]),
        limit: z.number().int().optional(),
        tags: z.record(z.string(), z.string()).optional(),
        verbose: z.boolean().default(false),
        default: z.string().optional(),
        target: z
          .discriminatedUnion("kind", [
            z.object({ kind: z.literal("url"), url: z.string() }).strict(),
            z.object({ kind: z.literal("id"), id: z.number().int().min(0) }).strict(),
          ])
          .optional(),
        pages: z.union([z.array(z.number().int()), z.string()]).optional(),
        note: z.union([z.string(), z.null()]).optional(),
        options: z.object({}).optional(),
      })
      .strict();
    const samples = [
      { mode: "fast" },
      { mode: "slow", limit: 3, tags: { a: "b" }, verbose: true, default: "x" },
      {
        mode: "fast",
        target: { kind: "url", url: "https://example.com" },
        pages: [0, 2],
      },
      {
        mode: "fast",
        target: { kind: "id", id: 4 },
        pages: "0-2",
        note: null,
        options: { a: 1 },
      },
      { mode: "medium" },
      { mode: "fast", limit: 1.5 },
      { mode: "fast", tags: { a: 1 } },
      { mode: "fast", target: { kind: "url", id: 1 } },
      { mode: "fast", target: { kind: "id", id: -1 } },
      { mode: "fast", pages: [true] },
      { mode: "fast", note: 5 },
      { mode: "fast", extra: true },
      { default: "x" },
    ];
    const { $schema: _schema, ...raw } = z.toJSONSchema(inputSchema, {
      io: "input",
    });
    const advertised = toToolInputJsonSchema(inputSchema);

    const expected = samples.map((_, index) => index < 4);

    expect(acceptance(raw, samples)).toEqual(expected);
    expect(acceptance(advertised, samples)).toEqual(expected);
    expect(JSON.stringify(advertised).length).toBeLessThan(JSON.stringify(raw).length);
    expect(advertised.properties).toMatchObject({
      mode: { type: "string", enum: ["fast", "slow"] },
      limit: { type: "integer" },
      default: { type: "string" },
    });
  });

  it("collapses repeated fields from root object unions into single choices", () => {
    const sessionId = z.string().min(1);
    const advertised = toToolInputJsonSchema(
      z.union([
        z.union([
          z.object({ operation: z.literal("start"), task: z.string() }).strict(),
          z.object({ operation: z.literal("inspect"), sessionId }).strict(),
        ]),
        z.object({ operation: z.literal("stop"), sessionId }).strict(),
        z.object({ operation: z.literal("inspect"), sessionId }).strict(),
      ]),
    );

    expect(advertised).toEqual({
      type: "object",
      properties: {
        operation: { type: "string", enum: ["start", "inspect", "stop"] },
        task: { type: "string" },
        sessionId: { type: "string", minLength: 1 },
      },
      required: ["operation"],
      additionalProperties: false,
    });
    expect(
      acceptance(advertised, [
        { operation: "start", task: "book a table" },
        { operation: "stop", sessionId: "s1" },
        { operation: "pause" },
      ]),
    ).toEqual([true, true, false]);
  });

  it("keeps an object root with no inputs declared as an object with properties", () => {
    expect(toToolInputJsonSchema(z.object({}).strict())).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  });
});
