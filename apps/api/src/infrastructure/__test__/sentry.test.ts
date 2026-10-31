import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureApiError, captureLoggedError, getSentryOptions } from "../sentry";

const scope = vi.hoisted(() => ({ setLevel: vi.fn(), setTag: vi.fn(), setContext: vi.fn() }));
const captureException = vi.hoisted(() => vi.fn());

vi.mock("@sentry/cloudflare", () => ({
  withScope: (callback: (value: typeof scope) => void) => callback(scope),
  captureException,
  isEnabled: () => true,
}));

const DSN = "https://key@example.ingest.sentry.io/1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSentryOptions", () => {
  it("reports to the ENV environment whenever a DSN is set", () => {
    expect(getSentryOptions({ ENV: "development", SENTRY_DSN: DSN })).toMatchObject({
      dsn: DSN,
      environment: "development",
    });
    expect(getSentryOptions({ ENV: "production" })).toEqual({ enabled: false });
  });

  it("traces AI calls and lets request traces follow the caller's sampling decision", () => {
    const sampler = getSentryOptions({ ENV: "production", SENTRY_DSN: DSN }).tracesSampler;
    const inheritOrSampleWith = (fallback: number) => fallback;

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
        inheritOrSampleWith,
      }),
    ).toBe(0);
    expect(
      sampler?.({
        name: "GET /chat",
        attributes: { "http.request.method": "GET" },
        parentSampled: true,
        inheritOrSampleWith: () => 1,
      }),
    ).toBe(1);
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

describe("captureLoggedError", () => {
  it("reports errors that were logged and swallowed, but not client failures or plain messages", () => {
    const swallowed = new Error("Queue write failed");

    captureLoggedError({ timestamp: 0, level: "error", message: "Failed", error: swallowed });
    captureLoggedError({
      timestamp: 0,
      level: "error",
      message: "Denied",
      error: new AssistantError("Denied", ErrorType.FORBIDDEN, 403),
    });
    captureLoggedError({ timestamp: 0, level: "error", message: "No error attached" });
    captureLoggedError({ timestamp: 0, level: "warn", message: "Slow", error: new Error("slow") });

    expect(captureException.mock.calls).toEqual([[swallowed]]);
  });
});
