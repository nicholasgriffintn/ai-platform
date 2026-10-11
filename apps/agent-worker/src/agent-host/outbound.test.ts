import { describe, expect, it, vi } from "vitest";

import type { Env } from "../types";
import { polychatModelsOutbound } from "./outbound";

describe("polychatModelsOutbound", () => {
  it("uses the shared model request schema and locks server-owned controls", async () => {
    let forwardedBody: unknown;
    const apiFetch = vi.fn(async (request: Request) => {
      forwardedBody = await request.json();

      return Response.json({ id: "completion" });
    });
    const env = { POLYCHAT_API: { fetch: apiFetch } } as unknown as Env;
    const request = new Request("http://polychat.internal/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "untrusted-model",
        mode: "agent",
        enabled_tools: ["run_code"],
        store: true,
        metadata: { project_id: "another-project" },
        stream: true,
        messages: [{ role: "user", content: "Do the work" }],
        tools: [{ type: "function", function: { name: "workspace_tool" } }],
      }),
    });

    const response = await polychatModelsOutbound(request, env, {
      containerId: "agent-host",
      params: { apiKey: "ak_member", modelTier: "medium" },
    });

    expect(response.status).toBe(200);
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch.mock.calls[0]?.[0].url).toBe("http://polychat-api/chat/completions");
    expect(apiFetch.mock.calls[0]?.[0].headers.get("Authorization")).toBe("Bearer ak_member");
    expect(forwardedBody).toEqual({
      stream: true,
      messages: [{ role: "user", content: "Do the work" }],
      tools: [{ type: "function", function: { name: "workspace_tool", parameters: {} } }],
      model_tier: "medium",
      store: false,
      enabled_tools: [],
    });
  });
});
