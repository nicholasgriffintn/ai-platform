import { INTERNAL_SERVICE_AUTHORIZATION_HEADER } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { Env } from "../types";
import { agentHostEgressOutbound, polychatApiOutbound } from "./outbound";

describe("polychatApiOutbound", () => {
  it("forwards the request unchanged with a scoped internal service identity", async () => {
    const serviceToken = "signed-service-token";
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
    const request = new Request("http://polychat.internal/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer polychat-gateway",
        "Content-Type": "application/json",
      },
      body,
    });

    const response = await polychatApiOutbound(request, env, { params: { serviceToken } });

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(forwardedRequest?.url).toBe("http://polychat-api/chat/completions");
    expect(forwardedRequest?.method).toBe("POST");
    expect(forwardedRequest?.headers.get("Authorization")).toBeNull();
    const serviceAuthorization = forwardedRequest?.headers.get(
      INTERNAL_SERVICE_AUTHORIZATION_HEADER,
    );

    if (!serviceAuthorization?.startsWith("Bearer ")) {
      throw new Error("Missing internal service authorization");
    }

    expect(serviceAuthorization).toBe(`Bearer ${serviceToken}`);
    expect(forwardedRequest?.headers.get("Content-Type")).toBe("application/json");
    await expect(forwardedRequest?.text()).resolves.toBe(body);
    expect(response).toBe(apiResponse);
    expect(response.status).toBe(422);
    expect(response.headers.get("X-API-Result")).toBe("preserved");
    await expect(response.text()).resolves.toBe("API response");
  });

  it("forwards model catalogue requests to the API", async () => {
    const serviceToken = "signed-service-token";
    const apiResponse = Response.json({ data: [{ id: "api-selected-model" }] });
    let forwardedRequest: Request | undefined;
    const apiFetch = vi.fn(async (request: Request) => {
      forwardedRequest = request;

      return apiResponse;
    });
    const env = { POLYCHAT_API: { fetch: apiFetch } } as unknown as Env;
    const request = new Request("http://polychat.internal/models");

    const response = await polychatApiOutbound(request, env, { params: { serviceToken } });

    expect(forwardedRequest?.url).toBe("http://polychat-api/models");
    expect(forwardedRequest?.method).toBe("GET");
    expect(response).toBe(apiResponse);
    await expect(response.json()).resolves.toEqual({ data: [{ id: "api-selected-model" }] });
  });

  it("does not call the API without a delegated service token", async () => {
    const apiFetch = vi.fn();
    const env = { POLYCHAT_API: { fetch: apiFetch } } as unknown as Env;
    const request = new Request("http://polychat.internal/chat/completions", {
      method: "POST",
      body: "{}",
    });

    await expect(polychatApiOutbound(request, env, { params: {} })).rejects.toThrow(
      "Agent host service authentication is not configured",
    );
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("agentHostEgressOutbound", () => {
  const policy = {
    mode: "list" as const,
    hosts: ["api.example.com"],
    readOnlyHosts: ["registry.npmjs.org"],
  };
  const env = {} as Env;

  it("allows declared hosts and registry reads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    try {
      const allowed = await agentHostEgressOutbound(
        new Request("https://api.example.com/v1", { method: "POST" }),
        env,
        { params: policy },
      );

      expect(allowed.status).toBe(200);

      const registry = await agentHostEgressOutbound(
        new Request("https://registry.npmjs.org/react", { method: "GET" }),
        env,
        { params: policy },
      );

      expect(registry.status).toBe(200);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("blocks registry writes, unknown hosts and missing policy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    try {
      const write = await agentHostEgressOutbound(
        new Request("https://registry.npmjs.org/react", { method: "PUT" }),
        env,
        { params: policy },
      );

      expect(write.status).toBe(403);
      await expect(write.text()).resolves.toContain("Hosted agents can read package registries");

      const unknown = await agentHostEgressOutbound(
        new Request("https://evil.example.com/", { method: "GET" }),
        env,
        { params: policy },
      );

      expect(unknown.status).toBe(403);

      const missing = await agentHostEgressOutbound(
        new Request("https://api.example.com/v1", { method: "GET" }),
        env,
        { params: null },
      );

      expect(missing.status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("strips authorization material before egress", async () => {
    let forwarded: Request | undefined;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: string | URL | Request) => {
        forwarded = new Request(input);

        return new Response("ok");
      });

    try {
      await agentHostEgressOutbound(
        new Request("https://api.example.com/v1", {
          method: "POST",
          headers: { Authorization: "Bearer secret", Cookie: "session=1" },
          body: "{}",
        }),
        env,
        { params: policy },
      );

      expect(forwarded?.headers.get("Authorization")).toBeNull();
      expect(forwarded?.headers.get("Cookie")).toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
