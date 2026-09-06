import { describe, expect, it } from "vitest";

import { AssistantError, ErrorType } from "../errors";
import {
  buildProviderResponseErrorDetails,
  classifyProviderRetryError,
  getProviderResponseErrorMessage,
  isProviderRateLimitError,
  parseProviderRetryAfterMs,
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

describe("provider retry classification", () => {
  it.each([
    [new AssistantError("busy", ErrorType.RATE_LIMIT_ERROR, 429), "rate_limited"],
    [new AssistantError("offline", ErrorType.NETWORK_ERROR, 502), "network"],
    [new DOMException("aborted", "AbortError"), "timeout"],
    [new AssistantError("unavailable", ErrorType.PROVIDER_ERROR, 503), "provider_unavailable"],
    [Object.assign(new Error("reset"), { code: "ECONNRESET" }), "network"],
  ])("classifies an eligible transient failure", (error, classification) => {
    expect(classifyProviderRetryError(error)).toMatchObject({
      retryable: true,
      classification,
    });
  });

  it.each([
    new AssistantError("credentials", ErrorType.AUTHENTICATION_ERROR, 401),
    new AssistantError("forbidden", ErrorType.FORBIDDEN, 403),
    new AssistantError("invalid", ErrorType.PARAMS_ERROR, 400),
    new AssistantError("conflict", ErrorType.CONFLICT_ERROR, 409),
    new AssistantError("limit", ErrorType.USAGE_LIMIT_ERROR, 429),
  ])("keeps a permanent or policy failure terminal", (error) => {
    expect(classifyProviderRetryError(error).retryable).toBe(false);
  });

  it("does not reinterpret a usage-limit 429 as provider rate limiting", () => {
    expect(
      isProviderRateLimitError(new AssistantError("limit", ErrorType.USAGE_LIMIT_ERROR, 429)),
    ).toBe(false);
  });

  it("parses Retry-After seconds and dates", () => {
    const now = Date.parse("2026-09-05T12:00:00.000Z");

    expect(parseProviderRetryAfterMs("2.5", now)).toBe(2500);
    expect(parseProviderRetryAfterMs("Sat, 05 Sep 2026 12:00:03 GMT", now)).toBe(3000);
    expect(parseProviderRetryAfterMs("invalid", now)).toBeUndefined();
  });
});
