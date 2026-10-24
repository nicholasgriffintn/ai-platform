import { describe, expect, it } from "vitest";

import { isCsrfExempt } from "./csrf";

describe("isCsrfExempt", () => {
  it("lets native clients that send a bearer token post forms and bodiless writes", () => {
    expect(isCsrfExempt({ path: "/audio/transcribe", authorization: "Bearer token-1" })).toBe(true);
    expect(isCsrfExempt({ path: "/discover/health", authorization: "Bearer token-1" })).toBe(true);
  });

  it("keeps cookie-authenticated browser requests under CSRF protection", () => {
    expect(isCsrfExempt({ path: "/audio/transcribe", authorization: undefined })).toBe(false);
    expect(isCsrfExempt({ path: "/audio/transcribe", authorization: "Basic abc" })).toBe(false);
  });

  it("leaves signed webhooks to their own verification", () => {
    expect(isCsrfExempt({ path: "/webhooks/github", authorization: undefined })).toBe(true);
  });
});
