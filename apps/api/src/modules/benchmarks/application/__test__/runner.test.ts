import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/infrastructure/ai", () => ({ ai: {} }));
vi.mock("~/modules/models/application/resolve", () => ({ getAuxiliaryModel: vi.fn() }));
vi.mock("~/modules/tasks/application/TaskService", () => ({ TaskService: vi.fn() }));
vi.mock("~/modules/usage/application/usageManager", () => ({ UsageManager: vi.fn() }));

import { benchmarkRetryDelayMs } from "../runner";

describe("benchmarkRetryDelayMs", () => {
  it("waits out the provider's retry-after hint", () => {
    const error = new AssistantError("Rate limit exceeded", ErrorType.RATE_LIMIT_ERROR, 429, {
      retryAfterMs: 58_000,
    });

    expect(benchmarkRetryDelayMs(error, 1)).toBe(59_000);
  });

  it("reads a retry hint from the message when no header was sent", () => {
    const error = new AssistantError(
      "Quota exceeded for metric: generate_content_free_tier_requests, limit: 15\nPlease retry in 6.758660039s.",
      ErrorType.RATE_LIMIT_ERROR,
      429,
    );

    expect(benchmarkRetryDelayMs(error, 1)).toBe(7_759);
  });

  it("backs off linearly without a hint and caps long waits", () => {
    const plain = new AssistantError("Service Unavailable", ErrorType.PROVIDER_ERROR, 503);
    const long = new AssistantError("Please retry in 600s", ErrorType.RATE_LIMIT_ERROR, 429);

    expect(benchmarkRetryDelayMs(plain, 2)).toBe(7_000);
    expect(benchmarkRetryDelayMs(long, 1)).toBe(90_000);
  });
});
