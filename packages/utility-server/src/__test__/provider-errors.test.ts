import { describe, expect, it } from "vitest";

import {
  buildProviderResponseErrorDetails,
  getProviderResponseErrorMessage,
  readProviderRejection,
} from "../provider-errors.js";

describe("provider response error details", () => {
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

describe("readProviderRejection", () => {
  it("keeps auth and server failures generic", () => {
    expect(readProviderRejection(401, { message: "bad key sk-123" })).toBeNull();
    expect(readProviderRejection(500, { message: "stack trace" })).toBeNull();
  });
});
