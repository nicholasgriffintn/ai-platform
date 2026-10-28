import { describe, expect, it } from "vitest";

import { getSentryOptions } from "../sentry";

describe("getSentryOptions", () => {
  it("traces AI calls and leaves request traces unsampled", () => {
    const sampler = getSentryOptions({
      ENV: "production",
      SENTRY_DSN: "https://key@example.ingest.sentry.io/1",
    })?.tracesSampler;
    const inheritOrSampleWith = () => 1;

    expect(
      sampler?.({
        name: "chat gpt-5",
        attributes: { "gen_ai.operation.name": "chat" },
        inheritOrSampleWith,
      }),
    ).toBe(1);
    expect(
      sampler?.({
        name: "GET /chat",
        attributes: { "http.request.method": "GET" },
        parentSampled: true,
        inheritOrSampleWith,
      }),
    ).toBe(0);
  });
});
