import { describe, expect, it } from "vitest";

import {
  buildProviderResponseErrorDetails,
  getProviderResponseErrorMessage,
} from "../providerErrors";

describe("provider response error details", () => {
  it("keeps the status and body when the provider returns JSON", () => {
    const details = buildProviderResponseErrorDetails({
      provider: "hetzner",
      endpoint: "https://inference.hetzner.com/api/v1/chat/completions",
      status: 401,
      statusText: "Unauthorized",
      requestId: "req_123",
      responseText: '{"error":"unauthorized"}',
    });

    expect(details.responseStatus).toBe(401);
    expect(details.responseStatusText).toBe("Unauthorized");
    expect(details.requestId).toBe("req_123");
    expect(details.responseJson).toEqual({ error: "unauthorized" });
    expect(getProviderResponseErrorMessage(details)).toContain("(401 Unauthorized): unauthorized");
  });

  it("still reports the status when the provider returns an unparsable body", () => {
    const details = buildProviderResponseErrorDetails({
      provider: "hetzner",
      endpoint: "https://inference.hetzner.com/api/v1/chat/completions",
      status: 502,
      statusText: "Bad Gateway",
      responseText: "",
    });

    expect(details.responseJson).toBeNull();
    expect(getProviderResponseErrorMessage(details)).toContain(
      "(502 Bad Gateway): empty response body",
    );
  });

  it("redacts credentials echoed back in the error body", () => {
    const details = buildProviderResponseErrorDetails({
      provider: "hetzner",
      endpoint: "https://inference.hetzner.com/api/v1/chat/completions",
      status: 400,
      responseText: '{"message":"bad authorization: Bearer sk-live-abcdefghijklmnopqrstuvwxyz"}',
    });

    expect(details.responseText).not.toContain("sk-live-abcdefghijklmnopqrstuvwxyz");
    expect(getProviderResponseErrorMessage(details)).not.toContain(
      "sk-live-abcdefghijklmnopqrstuvwxyz",
    );
  });
});
