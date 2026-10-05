import {
  resolveToolDestination,
  resolveToolEffectClass,
} from "@ngriffin_uk/polychat-library-tools";
import { CAPABILITY_DISCOVERY_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";
import z from "zod/v4";

import {
  expandFunctionToolNames,
  listFunctionTools,
  resolveFunctionTool,
} from "~/modules/functions/application";
import {
  resolveEnabledFunctionToolNames,
  resolveRequestFunctionToolNames,
} from "~/modules/functions/application/availability";

describe("functions tool registry", () => {
  it("classifies external calls by what they change and where", () => {
    const callApi = resolveFunctionTool("call_api");
    const connector = resolveFunctionTool("use_recipe_connector");

    expect(resolveToolEffectClass(callApi.effects, { url: "https://api.example.com/x" })).toBe(
      "read",
    );
    expect(
      resolveToolEffectClass(callApi.effects, {
        url: "https://api.example.com/x",
        method: "delete",
      }),
    ).toBe("destructive");
    expect(
      resolveToolEffectClass(callApi.effects, {
        url: "https://api.example.com",
        request_type: "graphql",
      }),
    ).toBe("write");
    expect(resolveToolDestination(callApi.effects, { url: "https://api.example.com/x?y=1" })).toBe(
      "https://api.example.com",
    );
    expect(
      resolveToolEffectClass(connector.effects, { provider: "github", useCase: "find PRs" }),
    ).toBe("read");
    expect(
      resolveToolEffectClass(connector.effects, {
        provider: "github",
        operation: "GITHUB_MERGE_PR",
      }),
    ).toBe("write");
  });

  it("keeps Composio operations out of the global function registry", () => {
    const names = listFunctionTools().map((tool) => tool.name);

    expect(names).toContain("use_recipe_connector");
    expect(names).not.toContain("posthog_list_organization_projects");
    expect(names).not.toContain("polymarket_us_create_order");
    expect(names.some((name) => name.startsWith("zeplin_"))).toBe(false);
  });

  it("tops a managed request up with the baseline without dropping configured tools", () => {
    const enabled = resolveRequestFunctionToolNames({
      requestedToolNames: ["code_execution", "run_council"],
      toolSelectionMode: "managed",
      user: { id: 1, plan_id: "pro" },
    });

    expect(enabled).toEqual([
      "code_execution",
      "run_council",
      CAPABILITY_DISCOVERY_TOOL_NAME,
      "load_skill",
      "web_search",
    ]);
  });

  it("keeps a project authoritative over everything but discovery", () => {
    const enabled = resolveRequestFunctionToolNames({
      projectTools: ["create_note", "load_skill"],
      requestedToolNames: ["create_note", "run_council"],
      toolSelectionMode: "managed",
      user: { id: 1, plan_id: "pro" },
    });

    expect(enabled).toEqual(["create_note", CAPABILITY_DISCOVERY_TOOL_NAME, "load_skill"]);
  });

  it("lets a platform teammate bring its own tools into a project", () => {
    const enabled = resolveRequestFunctionToolNames({
      projectTools: ["create_note"],
      requestedToolNames: ["search_documents", "create_note"],
      grantedToolNames: ["search_documents"],
      toolSelectionMode: "explicit",
      user: { id: 1, plan_id: "pro" },
    });

    expect(enabled).toEqual(["search_documents", "create_note"]);
  });

  it("does not switch platform tools on for other project chats", () => {
    const enabled = resolveRequestFunctionToolNames({
      projectTools: ["create_note"],
      requestedToolNames: ["search_documents", "create_note"],
      toolSelectionMode: "explicit",
      user: { id: 1, plan_id: "pro" },
    });

    expect(enabled).toEqual(["create_note"]);
  });

  it("activates companion tools alongside a discovered tool", () => {
    expect(expandFunctionToolNames(["run_pashi_tools"])).toEqual([
      "run_pashi_tools",
      "search_pashi_tools",
    ]);
    expect(expandFunctionToolNames(["web_search"])).toEqual(["web_search"]);
  });

  it("keeps an explicit tool selection authoritative", () => {
    const enabled = resolveEnabledFunctionToolNames(["search_grounding"], {
      id: 1,
      plan_id: "pro",
    });

    expect([...enabled]).toEqual(["search_grounding"]);
    expect(enabled.has(CAPABILITY_DISCOVERY_TOOL_NAME)).toBe(false);
    expect(enabled.has("load_skill")).toBe(false);
    expect(enabled.has("trigger_recipe")).toBe(false);
  });

  it("scopes connector providers to connected accounts for each request", () => {
    const tools = listFunctionTools({
      connectedConnectorProviders: ["gmail", "posthog"],
    });
    const connector = tools.find((tool) => tool.name === "use_recipe_connector");

    expect(connector).toBeDefined();
    if (!connector) {
      throw new Error("Connector tool was not registered");
    }

    const schema = z.toJSONSchema(connector.inputSchema);

    expect(schema.properties?.provider).toMatchObject({
      enum: ["gmail", "posthog"],
    });
    expect(schema.properties?.params).toMatchObject({
      description: "Parameters matching the exact schema returned by connector discovery.",
    });
  });

  it("omits the connector tool when the user has no connected providers", () => {
    const names = listFunctionTools({ connectedConnectorProviders: [] }).map((tool) => tool.name);

    expect(names).not.toContain("use_recipe_connector");
  });
});
