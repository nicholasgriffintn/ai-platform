import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it } from "vitest";

import { isPlatformFailure } from "../platform-failure";

describe("isPlatformFailure", () => {
  it.each([
    ["an unexpected crash", new Error("boom")],
    ["a provider outage", new AssistantError("down", ErrorType.PROVIDER_ERROR)],
    ["a provider rate limit", new AssistantError("slow", ErrorType.RATE_LIMIT_ERROR, 429)],
  ])("treats %s as ours", (_label, error) => {
    expect(isPlatformFailure(error)).toBe(true);
  });

  it.each([
    ["bad input", new AssistantError("bad", ErrorType.PARAMS_ERROR, 400)],
    ["an exhausted balance", new AssistantError("spent", ErrorType.USAGE_LIMIT_ERROR, 429)],
    ["a provider rejecting the request", new AssistantError("no", ErrorType.PROVIDER_ERROR, 400)],
  ])("does not refund %s", (_label, error) => {
    expect(isPlatformFailure(error)).toBe(false);
  });
});
