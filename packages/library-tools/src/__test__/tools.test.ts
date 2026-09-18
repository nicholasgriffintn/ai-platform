import { describe, expect, it } from "vitest";
import z from "zod/v4";

import { createToolCatalogue } from "../catalogue.js";
import { executeTool, validateToolInput } from "../execution.js";
import { ToolRegistry } from "../registry.js";
import { defineTool, toToolDeclaration, type ToolExecutionContext } from "../tool.js";

const context: ToolExecutionContext = { completionId: "c1", env: {} };

const weather = defineTool({
  name: "get_weather",
  description: "Get the weather",
  type: "normal",
  permissions: ["read"],
  inputSchema: z.object({ city: z.string().min(1), units: z.enum(["c", "f"]).default("c") }),
  normaliseInput: (input) =>
    typeof input === "string" ? { city: input } : (input as Record<string, unknown>),
  execute: async (input) => ({ content: `${input.city}:${input.units}` }),
  maxIdenticalCalls: 2,
  companionTools: ["get_forecast"],
});

const forecast = defineTool({
  name: "get_forecast",
  description: "Get the forecast",
  type: "premium",
  permissions: ["read"],
  inputSchema: z.object({ city: z.string() }),
  execute: async () => ({ content: "sunny" }),
});

describe("tool definitions", () => {
  it("derives a provider declaration from the zod input schema", () => {
    const declaration = toToolDeclaration(weather);

    expect(declaration.function.name).toBe("get_weather");
    expect(declaration.function.parameters).toMatchObject({
      type: "object",
      properties: { city: { type: "string" }, units: { enum: ["c", "f"] } },
      required: ["city"],
    });
  });

  it("normalises then validates input before executing", async () => {
    await expect(executeTool(weather, "Leeds", context)).resolves.toEqual({
      content: "Leeds:c",
    });
    expect(() => validateToolInput(weather, { city: "" })).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        toolName: "get_weather",
        issues: [expect.objectContaining({ path: "city" })],
      }),
    );
  });
});

describe("createToolCatalogue", () => {
  it("indexes tools, repeat limits and companions, and requires explicit permissions", () => {
    const catalogue = createToolCatalogue([weather, forecast]);

    expect(catalogue.list().map((tool) => tool.name)).toEqual(["get_weather", "get_forecast"]);
    expect(catalogue.resolve("get_weather").permissions).toEqual(["read"]);
    expect(catalogue.repeatLimit("get_weather")).toBe(2);
    expect(catalogue.expandCompanions(["get_weather"])).toEqual(["get_weather", "get_forecast"]);
    expect(() => catalogue.resolve("missing")).toThrowError(
      expect.objectContaining({ code: "unknown_tool" }),
    );
    expect(() => createToolCatalogue([{ ...forecast, permissions: [] }])).toThrowError(
      expect.objectContaining({ code: "missing_permissions" }),
    );
    expect(() => createToolCatalogue([weather, weather])).toThrowError(
      expect.objectContaining({ code: "duplicate_registration" }),
    );
  });
});

describe("ToolRegistry", () => {
  it("registers by category, resolves aliases, and reports coded errors", () => {
    const registry = new ToolRegistry();

    registry.register("functions", {
      name: "get_weather",
      aliases: ["weather"],
      create: () => weather,
    });

    expect(registry.resolve("functions", "WEATHER").name).toBe("get_weather");
    expect(registry.list("functions")).toEqual([
      expect.objectContaining({
        name: "get_weather",
        category: "functions",
        permissions: ["read"],
      }),
    ]);
    expect(registry.listDefinitions("functions")).toHaveLength(1);
    expect(() => registry.resolve("functions", "nope")).toThrowError(
      expect.objectContaining({ code: "unknown_tool", category: "functions" }),
    );
    expect(() => registry.resolve("other", "nope")).toThrowError(
      expect.objectContaining({ code: "unknown_category" }),
    );
  });
});
