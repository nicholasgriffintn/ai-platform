import { describe, expect, it } from "vitest";

import { isAllowedOrigin } from "./origins";

describe("isAllowedOrigin", () => {
  it("keeps the web origins it already allowed", () => {
    expect(isAllowedOrigin("http://localhost:5173", "development")).toBe(true);
    expect(isAllowedOrigin("https://polychat.app", "production")).toBe(true);
    expect(isAllowedOrigin("https://polychat.app.evil.test", "production")).toBe(false);
    expect(isAllowedOrigin("", "production")).toBe(false);
    expect(isAllowedOrigin("not a url", "development")).toBe(false);
  });
});
