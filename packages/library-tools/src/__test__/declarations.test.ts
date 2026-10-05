import { describe, expect, it } from "vitest";
import z from "zod/v4";

import { declareTool } from "../declaration.js";
import { flattenObjectRootSchema } from "../json-schema.js";
import { PermissionChecker, resolveModeMaxSteps, resolveToolPermissions } from "../permissions.js";
import { toProviderToolDeclarations } from "../provider-declarations.js";
import { toToolDeclaration } from "../tool.js";

describe("declareTool with a generated schema", () => {
  it("keeps schema keys the convenience form cannot express", () => {
    const definition = declareTool({
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

describe("toProviderToolDeclarations", () => {
  const definition = declareTool({
    name: "get_weather",
    description: "Look up the weather",
    parameters: { location: { type: "string" } },
    required: ["location"],
  });

  it("wraps definitions in the bedrock tool spec", () => {
    expect(toProviderToolDeclarations("bedrock", [definition])).toEqual([
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
    expect(toProviderToolDeclarations("anthropic", [definition])).toEqual([
      {
        name: "get_weather",
        description: "Look up the weather",
        input_schema: definition.function.parameters,
      },
    ]);
  });
});

describe("flattenObjectRootSchema", () => {
  it("keeps all provider and operation choices in a generated tool declaration", () => {
    const declaration = toToolDeclaration({
      name: "computer",
      description: "Operate either computer provider",
      inputSchema: z.union([
        z.object({ provider: z.literal("hosted"), operation: z.literal("observe") }).strict(),
        z
          .object({
            provider: z.literal("openai"),
            operation: z.literal("start"),
            task: z.string(),
          })
          .strict(),
      ]),
    });
    const schema = z.fromJSONSchema(declaration.function.parameters);

    expect(schema.safeParse({ provider: "hosted", operation: "observe" }).success).toBe(true);
    expect(
      schema.safeParse({ provider: "openai", operation: "start", task: "Read the page" }).success,
    ).toBe(true);
    expect(schema.safeParse({ provider: "unknown", operation: "observe" }).success).toBe(false);
  });

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
});

describe("resolveToolPermissions", () => {
  it("normalises, de-duplicates, and drops unknown permissions", () => {
    expect(resolveToolPermissions("any", ["READ", "read", "nonsense", "write"])).toEqual([
      "read",
      "write",
    ]);
    expect(resolveToolPermissions("any")).toEqual([]);
  });
});

describe("resolveModeMaxSteps", () => {
  it("clamps a request to the mode ceiling", () => {
    expect(resolveModeMaxSteps("plan", 30)).toBe(24);
    expect(resolveModeMaxSteps("build", 10)).toBe(10);
    expect(resolveModeMaxSteps("normal")).toBe(8);
  });
});

describe("PermissionChecker", () => {
  const checker = new PermissionChecker();

  it("gates premium and BYOK tools by plan and sign-in", () => {
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

    expect(
      checker.checkToolAccess({
        toolName: "research",
        toolType: "byok",
        user: { id: 1, plan_id: "free" },
      }),
    ).toMatchObject({ allowed: true });

    expect(checker.checkToolAccess({ toolName: "research", toolType: "byok" })).toMatchObject({
      allowed: false,
      reason: "This tool requires a signed-in user",
    });
  });

  it("requires approval for a permission the caller adds beyond the mode's", () => {
    expect(
      checker.checkToolAccess({
        toolName: "web_search",
        mode: "chat",
        toolPermissions: ["network"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: false });

    expect(
      checker.checkToolAccess({
        toolName: "web_search",
        mode: "chat",
        toolPermissions: ["network"],
        requireApprovalFor: ["network"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: true });
  });

  it("ignores an added permission the tool does not hold", () => {
    expect(
      checker.checkToolAccess({
        toolName: "web_search",
        mode: "chat",
        toolPermissions: ["network"],
        requireApprovalFor: ["sandbox"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: false });
  });

  it("blocks a tool whose permission the mode denies", () => {
    for (const [mode, toolName, permission] of [
      ["plan", "run_command", "sandbox"],
      ["plan", "call_api", "network"],
      ["explore", "create_note", "write"],
    ]) {
      expect(
        checker.checkToolAccess({ toolName, mode, toolPermissions: [permission] }),
      ).toMatchObject({ allowed: false, mode });
    }
  });

  it("allows questions but not side-effect approval requests in plan mode", () => {
    for (const [toolName, permission] of [
      ["web_search", "read"],
      ["complete_goal", "reasoning"],
    ]) {
      expect(
        checker.checkToolAccess({ toolName, mode: "plan", toolPermissions: [permission] }),
      ).toMatchObject({ allowed: true, requiresApproval: false, mode: "plan" });
    }

    expect(
      checker.checkToolAccess({
        toolName: "ask_user",
        mode: "plan",
        toolPermissions: ["human"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: false, mode: "plan" });

    expect(
      checker.checkToolAccess({
        toolName: "request_approval",
        mode: "plan",
        toolPermissions: ["human"],
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

    expect(
      checker.checkToolAccess({
        toolName: "run_command",
        mode: "normal",
        toolPermissions: ["sandbox", "write"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: false });
  });

  it("uses the caller's approval policy without hidden mode restrictions when requested", () => {
    expect(
      checker.checkToolAccess({
        toolName: "use_recipe_connector",
        mode: "plan",
        toolPermissions: ["network"],
        enforceModePolicy: false,
      }),
    ).toMatchObject({ allowed: true, requiresApproval: false, mode: "plan" });

    expect(
      checker.checkToolAccess({
        toolName: "update_file",
        mode: "build",
        toolPermissions: ["write"],
        requireApprovalFor: ["write"],
        enforceModePolicy: false,
      }),
    ).toMatchObject({ allowed: true, requiresApproval: true, mode: "build" });
  });

  it("reports whether a tool was pre-approved", () => {
    expect(
      checker.checkRequestToolAccess({
        toolName: "run_command",
        mode: "build",
        toolPermissions: ["sandbox"],
        approvedTools: [" RUN_COMMAND "],
      }),
    ).toMatchObject({ approved: true });

    expect(
      checker.checkRequestToolAccess({
        toolName: "run_command",
        mode: "build",
        toolPermissions: ["sandbox"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: true, approved: false });
  });
});
