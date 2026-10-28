import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it, vi } from "vitest";

import { captureApiError, getSentryOptions } from "../sentry";

const scope = vi.hoisted(() => ({ setLevel: vi.fn(), setTag: vi.fn() }));
const captureException = vi.hoisted(() => vi.fn());

vi.mock("@sentry/cloudflare", () => ({
  withScope: (callback: (value: typeof scope) => void) => callback(scope),
  captureException,
}));

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

describe("captureApiError", () => {
  it("reports rate limits as warnings and server failures as errors", () => {
    captureApiError(new AssistantError("Rate limit exceeded", ErrorType.RATE_LIMIT_ERROR, 429));
    captureApiError(new AssistantError("Database down", ErrorType.DATABASE_ERROR));
    captureApiError(new AssistantError("Bad input", ErrorType.PARAMS_ERROR, 400));

    expect(scope.setLevel.mock.calls).toEqual([["warning"], ["error"]]);
    expect(captureException).toHaveBeenCalledTimes(2);
  });
});
