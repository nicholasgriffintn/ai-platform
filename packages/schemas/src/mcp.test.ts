import { expect, it } from "vitest";

import { mcpConnectionInputSchema } from "./mcp.js";

it("requires explicit recipient consent and rejects private or credential-bearing endpoints", () => {
  const input = {
    label: "Test",
    url: "https://mcp.example.test/api",
    token: "dummy-test-token",
    allowedTools: ["search"],
    credentialRecipient: "openai",
  };

  expect(
    mcpConnectionInputSchema.safeParse({ ...input, credentialRecipient: undefined }).success,
  ).toBe(false);
  for (const url of [
    "http://example.test",
    "https://localhost/api",
    "https://127.0.0.1/api",
    "https://user:password@example.test/api",
    "https://example.test/api?token=dummy",
  ]) {
    expect(mcpConnectionInputSchema.safeParse({ ...input, url }).success).toBe(false);
  }
});
