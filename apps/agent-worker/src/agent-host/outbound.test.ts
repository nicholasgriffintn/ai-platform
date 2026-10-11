import { createChatCompletionsJsonSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { Env } from "../types";
import { polychatModelsOutbound } from "./outbound";

describe("polychatModelsOutbound", () => {
  it("forwards the API contract and applies only server-owned controls", async () => {
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
        model: "polychat",
        temperature: 0.4,
        store: true,
        metadata: { source: "hermes" },
        stream: true,
        messages: [{ role: "user", content: "Do the work" }],
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
    expect(createChatCompletionsJsonSchema.safeParse(forwardedBody).success).toBe(true);
    expect(forwardedBody).toEqual({
      temperature: 0.4,
      metadata: { source: "hermes" },
      stream: true,
      messages: [{ role: "user", content: "Do the work" }],
      model_tier: "medium",
      store: false,
      enabled_tools: [],
    });
  });

  it("passes unsupported fields to the API for global schema validation", async () => {
    let forwardedBody: unknown;
    const apiFetch = vi.fn(async (request: Request) => {
      forwardedBody = await request.json();
      const validation = createChatCompletionsJsonSchema.safeParse(forwardedBody);

      return validation.success
        ? Response.json({ id: "completion" })
        : Response.json({ error: validation.error.issues }, { status: 400 });
    });
    const env = { POLYCHAT_API: { fetch: apiFetch } } as unknown as Env;
    const request = new Request("http://polychat.internal/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "polychat",
        messages: [{ role: "user", content: "Do the work" }],
        unsupported_option: true,
      }),
    });

    const response = await polychatModelsOutbound(request, env, {
      containerId: "agent-host",
      params: { apiKey: "ak_member", modelTier: "medium" },
    });

    expect(response.status).toBe(400);
    expect(forwardedBody).toMatchObject({ unsupported_option: true });
    expect(createChatCompletionsJsonSchema.safeParse(forwardedBody).success).toBe(false);
    expect(await response.json()).toMatchObject({
      error: [expect.objectContaining({ code: "unrecognized_keys" })],
    });
  });
});
