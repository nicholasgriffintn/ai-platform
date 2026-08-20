import { describe, expect, it } from "vitest";

import { finishToolDefinition, UPDATE_PLAN_TOOL_NAME } from "../control-tools";
import { defineTool, getToolDefinitionNames, isToolDefinition } from "../define-tool";
import { flattenObjectRootSchema } from "../json-schema";
import { PermissionChecker, resolveModeMaxSteps, resolveToolPermissions } from "../permissions";
import { toProviderToolDefinitions } from "../provider-tools";

describe("defineTool", () => {
  it("produces the provider-facing function shape", () => {
    expect(
      defineTool({
        name: "run_command",
        description: "Run a shell command",
        parameters: { command: { type: "string" } },
        required: ["command"],
      }),
    ).toEqual({
      type: "function",
      function: {
        name: "run_command",
        description: "Run a shell command",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      },
    });
  });

  it("omits required when a tool takes no mandatory arguments", () => {
    const definition = defineTool({ name: "ping", description: "Ping" });

    expect(definition.function.parameters).toEqual({ type: "object", properties: {} });
  });

  it("recognises its own output and rejects other shapes", () => {
    expect(isToolDefinition(finishToolDefinition)).toBe(true);
    expect(isToolDefinition({ type: "function" })).toBe(false);
    expect(isToolDefinition(null)).toBe(false);
  });

  it("lists definition names", () => {
    expect(getToolDefinitionNames([finishToolDefinition])).toEqual(["finish"]);
  });
});

describe("defineTool with a generated schema", () => {
  it("keeps schema keys the convenience form cannot express", () => {
    const definition = defineTool({
      name: "trigger_recipe",
      description: "Run a recipe",
      schema: {
        properties: { recipeId: { type: "string" } },
        required: ["recipeId"],
        additionalProperties: false,
      },
    });

    expect(definition.function.parameters).toEqual({
      type: "object",
      properties: { recipeId: { type: "string" } },
      required: ["recipeId"],
      additionalProperties: false,
    });
  });
});

describe("toProviderToolDefinitions", () => {
  const definition = defineTool({
    name: "get_weather",
    description: "Look up the weather",
    parameters: { location: { type: "string" } },
    required: ["location"],
  });

  it("wraps definitions in the bedrock tool spec", () => {
    expect(toProviderToolDefinitions("bedrock", [definition])).toEqual([
      {
        toolSpec: {
          name: "get_weather",
          description: "Look up the weather",
          inputSchema: { json: definition.function.parameters },
        },
      },
    ]);
  });

  it("uses anthropic's input_schema envelope", () => {
    expect(toProviderToolDefinitions("anthropic", [definition])).toEqual([
      {
        name: "get_weather",
        description: "Look up the weather",
        input_schema: definition.function.parameters,
      },
    ]);
  });

  it("passes the canonical shape through for every other provider", () => {
    expect(toProviderToolDefinitions("openai", [definition])).toEqual([definition]);
  });
});

describe("flattenObjectRootSchema", () => {
  it("merges object alternatives into a single root", () => {
    expect(
      flattenObjectRootSchema({
        anyOf: [
          {
            type: "object",
            properties: { recipeId: { type: "string" } },
            required: ["recipeId", "scope"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query", "scope"],
            additionalProperties: false,
          },
        ],
      }),
    ).toEqual({
      type: "object",
      properties: { recipeId: { type: "string" }, query: { type: "string" } },
      required: ["scope"],
      additionalProperties: false,
    });
  });

  it("leaves a schema without object alternatives untouched", () => {
    const schema = { type: "object", properties: { query: { type: "string" } } };

    expect(flattenObjectRootSchema(schema)).toBe(schema);
  });
});

describe("control tools", () => {
  it("keeps the loop control names stable", () => {
    expect(UPDATE_PLAN_TOOL_NAME).toBe("update_plan");
    expect(finishToolDefinition.function.parameters).toMatchObject({ required: ["summary"] });
  });
});

describe("resolveToolPermissions", () => {
  it("normalises, de-duplicates, and drops unknown permissions", () => {
    expect(resolveToolPermissions("any", ["READ", "read", "nonsense", "write"])).toEqual([
      "read",
      "write",
    ]);
  });

  it("returns nothing when no permissions are configured", () => {
    expect(resolveToolPermissions("any", [])).toEqual([]);
  });
});

describe("resolveModeMaxSteps", () => {
  it("clamps a request to the mode ceiling", () => {
    expect(resolveModeMaxSteps("plan", 30)).toBe(24);
    expect(resolveModeMaxSteps("build", 10)).toBe(10);
  });

  it("falls back to the mode default", () => {
    expect(resolveModeMaxSteps("normal")).toBe(8);
  });
});

describe("PermissionChecker", () => {
  const checker = new PermissionChecker();

  it("gates premium tools on the pro plan", () => {
    expect(
      checker.checkToolAccess({
        toolName: "create_note",
        toolType: "premium",
        user: { id: 1, plan_id: "free" },
      }),
    ).toMatchObject({ allowed: false, reason: "This tool requires a premium subscription" });

    expect(
      checker.checkToolAccess({
        toolName: "create_note",
        toolType: "premium",
        user: { id: 1, plan_id: "pro" },
      }),
    ).toMatchObject({ allowed: true });
  });

  it("blocks a tool whose permission the mode denies", () => {
    expect(
      checker.checkToolAccess({
        toolName: "run_command",
        mode: "plan",
        toolPermissions: ["sandbox"],
      }),
    ).toMatchObject({ allowed: false, mode: "plan" });
  });

  it("marks approval-required permissions in build mode", () => {
    expect(
      checker.checkToolAccess({
        toolName: "run_command",
        mode: "build",
        toolPermissions: ["sandbox"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: true });
  });

  it("reports whether a tool was pre-approved", () => {
    expect(
      checker.checkRequestToolAccess({
        toolName: "run_command",
        mode: "build",
        toolPermissions: ["sandbox"],
        approvedTools: ["RUN_COMMAND"],
      }),
    ).toMatchObject({ approved: true });
  });
});
