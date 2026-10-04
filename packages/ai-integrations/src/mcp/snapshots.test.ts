import { describe, expect, it } from "vitest";

import { createIntegrationSnapshot } from "./snapshots.js";

describe("MCP definition drift", () => {
  it("keeps metadata and ordering out of authority but detects schema and security changes", async () => {
    const initial = {
      endpoint: "https://tools.example.com/mcp",
      authentication: "bearer",
      tools: [
        {
          name: "search",
          description: "Find messages",
          inputSchema: { type: "object", properties: { query: { type: "string" } } },
        },
        { name: "send", inputSchema: { type: "object" } },
      ],
    } as const;
    const saved = await createIntegrationSnapshot(initial);
    const metadataChange = await createIntegrationSnapshot({
      ...initial,
      tools: [initial.tools[1], { ...initial.tools[0], description: "Find recent messages" }],
    });

    expect(metadataChange.digest).toBe(saved.digest);
    const schemaChange = await createIntegrationSnapshot({
      ...initial,
      tools: [
        { ...initial.tools[0], inputSchema: { type: "object", required: ["query"] } },
        initial.tools[1],
      ],
    });

    expect(schemaChange.digest).not.toBe(saved.digest);
    const outputChange = await createIntegrationSnapshot({
      ...initial,
      tools: [
        { ...initial.tools[0], outputSchema: { type: "object", required: ["results"] } },
        initial.tools[1],
      ],
    });

    expect(outputChange.digest).not.toBe(saved.digest);
    const behaviourChange = await createIntegrationSnapshot({
      ...initial,
      tools: [{ ...initial.tools[0], annotations: { destructiveHint: true } }, initial.tools[1]],
    });

    expect(behaviourChange.digest).not.toBe(saved.digest);
    const endpointChange = await createIntegrationSnapshot({
      ...initial,
      endpoint: "https://other.example.com/mcp",
    });

    expect(endpointChange.digest).not.toBe(saved.digest);
  });

  it("rejects duplicate tool identifiers and unsafe endpoints", async () => {
    await expect(
      createIntegrationSnapshot({
        endpoint: "https://tools.example.com/mcp",
        authentication: "none",
        tools: [
          { name: "same", inputSchema: {} },
          { name: "same", inputSchema: {} },
        ],
      }),
    ).rejects.toThrow("duplicate tool names");
    await expect(
      createIntegrationSnapshot({
        endpoint: "https://127.0.0.1/mcp",
        authentication: "none",
        tools: [],
      }),
    ).rejects.toThrow();
  });
});
