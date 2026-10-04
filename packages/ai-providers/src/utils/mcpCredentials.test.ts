import { expect, it, vi } from "vitest";

import { resolveHostedMcpCredentials } from "./mcpCredentials";

it("resolves only opaque saved references, strips overrides and preserves approvals without mutating stored input", async () => {
  const resolveCredential = vi.fn(async () => ({
    authorization: "dummy-token",
    allowedTools: ["search"],
  }));
  const body = {
    tools: [
      {
        type: "mcp",
        server_label: "caipe",
        server_url: "https://mcp.example.test/",
        credential_connection_id: "saved",
        require_approval: "never",
        authorization: "override",
        headers: { Authorization: "override" },
        allowed_tools: ["search"],
      },
    ],
  };
  const result = await resolveHostedMcpCredentials(body, { mcp: { resolveCredential } }, "openai", {
    user: { id: 1 },
  });

  expect(resolveCredential).toHaveBeenCalledWith(
    { user: { id: 1 } },
    {
      connectionId: "saved",
      url: "https://mcp.example.test/",
      provider: "openai",
      allowedTools: ["search"],
    },
  );
  expect(result.tools).toEqual([
    {
      type: "mcp",
      server_label: "caipe",
      server_url: "https://mcp.example.test/",
      require_approval: "always",
      authorization: "dummy-token",
      allowed_tools: ["search"],
    },
  ]);
  expect(JSON.stringify(body)).not.toContain("dummy-token");
});

it("fails closed when credential resolution or signed-in authority is unavailable", async () => {
  const body = {
    tools: [
      { type: "mcp", server_url: "https://mcp.example.test/", credential_connection_id: "saved" },
    ],
  };

  await expect(
    resolveHostedMcpCredentials(body, {}, "openai", { user: { id: 1 } }),
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    resolveHostedMcpCredentials(body, { mcp: { resolveCredential: vi.fn() } }, "openai"),
  ).rejects.toMatchObject({ statusCode: 403 });
});
