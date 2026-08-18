import { describe, expect, it } from "vitest";

import { ApiError } from "./index";
import { shouldRetryApiQuery } from "./retry";

describe("shouldRetryApiQuery", () => {
  it("retries transient failures but not authentication failures", () => {
    expect(shouldRetryApiQuery(0, new ApiError("Server error", 500))).toBe(true);
    expect(shouldRetryApiQuery(0, new ApiError("Unauthorized", 401))).toBe(false);
    expect(shouldRetryApiQuery(2, new ApiError("Server error", 500))).toBe(false);
  });
});
