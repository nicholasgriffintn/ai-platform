import { describe, expect, it, vi } from "vitest";

import type { Env } from "../types";
import { polychatApiOutbound } from "./outbound";

describe("polychatApiOutbound", () => {
  it("forwards the request unchanged apart from the scoped API credential", async () => {
    const body = JSON.stringify({
      model: "",
      messages: [{ role: "user", content: "Do the work" }],
      unsupported_option: true,
      store: true,
    });
    const apiResponse = new Response("API response", {
      status: 422,
      headers: { "Content-Type": "text/plain", "X-API-Result": "preserved" },
    });
    let forwardedRequest: Request | undefined;
    const apiFetch = vi.fn(async (request: Request) => {
      forwardedRequest = request;

      return apiResponse;
    });
    const env = { POLYCHAT_API: { fetch: apiFetch } } as unknown as Env;
    const request = new Request("http://polychat.internal/chat/completions?source=hermes", {
      method: "POST",
      headers: {
        Authorization: "Bearer polychat-gateway",
        "Content-Type": "application/json",
        "X-Request-Source": "hermes",
      },
      body,
    });

    const response = await polychatApiOutbound(request, env, {
      params: { apiKey: "ak_member" },
    });

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(forwardedRequest?.url).toBe("http://polychat-api/chat/completions?source=hermes");
    expect(forwardedRequest?.method).toBe("POST");
    expect(forwardedRequest?.headers.get("Authorization")).toBe("Bearer ak_member");
    expect(forwardedRequest?.headers.get("Content-Type")).toBe("application/json");
    expect(forwardedRequest?.headers.get("X-Request-Source")).toBe("hermes");
    await expect(forwardedRequest?.text()).resolves.toBe(body);
    expect(response).toBe(apiResponse);
    expect(response.status).toBe(422);
    expect(response.headers.get("X-API-Result")).toBe("preserved");
    await expect(response.text()).resolves.toBe("API response");
  });

  it("forwards model catalogue requests to the API", async () => {
    const apiResponse = Response.json({ data: [{ id: "api-selected-model" }] });
    let forwardedRequest: Request | undefined;
    const apiFetch = vi.fn(async (request: Request) => {
      forwardedRequest = request;

      return apiResponse;
    });
    const env = { POLYCHAT_API: { fetch: apiFetch } } as unknown as Env;
    const request = new Request("http://polychat.internal/models");

    const response = await polychatApiOutbound(request, env, {
      params: { apiKey: "ak_member" },
    });

    expect(forwardedRequest?.url).toBe("http://polychat-api/models");
    expect(forwardedRequest?.method).toBe("GET");
    expect(response).toBe(apiResponse);
    await expect(response.json()).resolves.toEqual({ data: [{ id: "api-selected-model" }] });
  });
});
