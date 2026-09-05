import { describe, expect, it } from "vitest";

import { getChatStreamLoadingMessage } from "../stream-state";

describe("getChatStreamLoadingMessage", () => {
  it("shows exact retry attempt accounting", () => {
    expect(
      getChatStreamLoadingMessage("retry", {
        retry: {
          protocolVersion: 1,
          step: 2,
          attempt: 2,
          maxAttempts: 2,
          runRetry: 1,
          maxRunRetries: 2,
          phase: "waiting",
          classification: "provider_unavailable",
          reason: "The model provider is temporarily unavailable.",
          scheduledAt: "2026-09-05T12:00:00.000Z",
          retryAt: "2026-09-05T12:00:01.000Z",
        },
      }),
    ).toBe("Retrying model — attempt 2 of 2, run retry 1 of 2...");
  });
});
