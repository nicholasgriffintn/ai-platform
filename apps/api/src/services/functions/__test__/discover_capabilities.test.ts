import { describe, expect, it } from "vitest";

import { DeferredToolSession, type DeferredToolEntry } from "~/lib/tools/DeferredToolSession";
import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";

import { discover_capabilities } from "../discover_capabilities";

const externalEntry: DeferredToolEntry = {
  group: "GitHub",
  origin: "external",
  definition: {
    name: "mcp_a1b2_create_issue",
    description: "Open a new issue on a repository.",
    parameters: { type: "object", properties: {} },
  },
};

function createContext(deferredTools?: DeferredToolSession): ToolExecutionContext {
  return {
    request: {
      env: {},
      request: { enabled_tools: [] },
      deferredTools,
    },
  } as unknown as ToolExecutionContext;
}

describe("discover_capabilities loading deferred tools", () => {
  it("loads a withheld function tool it just surfaced", async () => {
    const session = new DeferredToolSession([
      {
        group: "Assistant tools",
        origin: "function",
        definition: { name: "get_weather", description: "Look up the weather." },
      },
    ]);

    const response = await discover_capabilities.execute(
      { query: "weather", limit: 5 },
      createContext(session),
    );

    expect(response.status).toBe("success");
    expect(session.isWithheld("get_weather")).toBe(false);
  });

  it("does not load a tool the user's plan cannot run", async () => {
    const session = new DeferredToolSession([
      {
        group: "Assistant tools",
        origin: "function",
        definition: { name: "create_image", description: "Generate an image." },
      },
    ]);

    await discover_capabilities.execute(
      { query: "create an image", limit: 5 },
      createContext(session),
    );

    expect(session.isWithheld("create_image")).toBe(true);
  });

  it("loads a withheld external tool that the function registry does not know", async () => {
    const session = new DeferredToolSession([externalEntry]);

    await discover_capabilities.execute(
      { query: "create issue", limit: 5 },
      createContext(session),
    );

    expect(session.loadedDefinitions("external").map((definition) => definition.name)).toEqual([
      "mcp_a1b2_create_issue",
    ]);
  });

  it("leaves the catalogue untouched when nothing matches", async () => {
    const session = new DeferredToolSession([externalEntry]);

    await discover_capabilities.execute(
      { query: "transcribe a cello concerto", limit: 5 },
      createContext(session),
    );

    expect(session.withheldNames()).toEqual(["mcp_a1b2_create_issue"]);
  });

  it("runs without a session at all", async () => {
    const response = await discover_capabilities.execute(
      { query: "create an image", limit: 5 },
      createContext(),
    );

    expect(response.status).toBe("success");
  });
});
