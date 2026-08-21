import { CAPABILITY_DISCOVERY_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";
import z from "zod/v4";

import { formatToolCalls } from "~/lib/chat/tools/execution";
import { listFunctionTools, resolveFunctionTool, toolRegistry } from "~/services/functions";

describe("functions tool registry", () => {
  it("registers every function in the tool registry", () => {
    const functionTools = listFunctionTools();
    const registeredTools = toolRegistry.list("functions");

    expect(registeredTools).toHaveLength(functionTools.length);

    const registeredNames = new Set(registeredTools.map((tool) => tool.name));

    for (const fn of functionTools) {
      expect(registeredNames.has(fn.name)).toBe(true);
    }
  });

  it("resolves tool definitions for every available function", () => {
    for (const fn of listFunctionTools()) {
      const definition = resolveFunctionTool(fn.name);

      expect(definition.name).toBe(fn.name);
      expect(typeof definition.execute).toBe("function");
      expect(typeof definition.inputSchema.safeParse).toBe("function");
    }
  });

  it("keeps Composio operations out of the global function registry", () => {
    const names = listFunctionTools().map((tool) => tool.name);

    expect(names).toContain("use_recipe_connector");
    expect(names).not.toContain("posthog_list_organization_projects");
    expect(names).not.toContain("polymarket_us_create_order");
    expect(names.some((name) => name.startsWith("zeplin_"))).toBe(false);
  });

  it("registers capability discovery as a default read-only tool", () => {
    const discovery = resolveFunctionTool(CAPABILITY_DISCOVERY_TOOL_NAME);
    const names = listFunctionTools().map((tool) => tool.name);

    expect(discovery.isDefault).toBe(true);
    expect(discovery.permissions).toEqual(["read"]);
    expect(names).not.toContain("search_functions");
    expect(names).not.toContain("get_function_schema");
  });

  it("keeps the defaulted discovery limit optional in the model schema", () => {
    const discovery = resolveFunctionTool(CAPABILITY_DISCOVERY_TOOL_NAME);
    const schema = z.toJSONSchema(discovery.inputSchema);

    expect(schema.required).not.toContain("limit");
    expect(schema.properties?.limit).toMatchObject({ default: 8 });
    expect(discovery.inputSchema.parse({ query: "analytics" })).toMatchObject({ limit: 8 });
  });

  it("scopes connector providers to connected accounts for each request", () => {
    const tools = listFunctionTools({ connectedConnectorProviders: ["gmail", "posthog"] });
    const connector = tools.find((tool) => tool.name === "use_recipe_connector");

    expect(connector).toBeDefined();
    if (!connector) {
      throw new Error("Connector tool was not registered");
    }

    const schema = z.toJSONSchema(connector.inputSchema);

    expect(schema.properties?.provider).toMatchObject({ enum: ["gmail", "posthog"] });
    expect(schema.properties?.params).toMatchObject({
      description: "Parameters matching the exact schema returned by connector discovery.",
    });
  });

  it("omits the connector tool when the user has no connected providers", () => {
    const names = listFunctionTools({ connectedConnectorProviders: [] }).map((tool) => tool.name);

    expect(names).not.toContain("use_recipe_connector");
  });

  it("publishes closed schemas for recipe and web-search tools", () => {
    const triggerRecipe = resolveFunctionTool("trigger_recipe");
    const useRecipeConnector = resolveFunctionTool("use_recipe_connector");
    const webSearch = resolveFunctionTool("web_search");
    const triggerRecipeSchema = z.toJSONSchema(triggerRecipe.inputSchema);
    const formattedTriggerRecipe = formatToolCalls("deepseek", [triggerRecipe])[0];
    const useRecipeConnectorSchema = z.toJSONSchema(useRecipeConnector.inputSchema);
    const webSearchSchema = z.toJSONSchema(webSearch.inputSchema);

    expect(triggerRecipe.inputSchema.safeParse({}).success).toBe(false);
    expect(triggerRecipe.inputSchema.safeParse({ recipeId: "recipe-1" }).success).toBe(true);
    expect(triggerRecipe.inputSchema.safeParse({ query: "run my alert" }).success).toBe(true);
    expect(formattedTriggerRecipe).toMatchObject({
      type: "function",
      function: { parameters: { type: "object", additionalProperties: false } },
    });
    expect((formattedTriggerRecipe as any).function.parameters.anyOf).toBeUndefined();
    expect(Object.keys((formattedTriggerRecipe as any).function.parameters.properties)).toEqual(
      expect.arrayContaining(["recipeId", "query", "input"]),
    );
    expect(triggerRecipeSchema.anyOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ required: ["recipeId"], additionalProperties: false }),
        expect.objectContaining({ required: ["query"], additionalProperties: false }),
      ]),
    );
    expect(useRecipeConnectorSchema.additionalProperties).toBe(false);
    expect(webSearchSchema.additionalProperties).toBe(false);
    expect(webSearchSchema.properties?.search_depth).toMatchObject({
      type: "string",
      enum: ["basic", "advanced"],
    });
  });
});
