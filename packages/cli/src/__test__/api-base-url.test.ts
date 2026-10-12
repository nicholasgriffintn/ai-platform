import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl } from "../api-base-url.js";

describe("resolveApiBaseUrl", () => {
  it("refuses to send keys over plain http to anything but localhost", () => {
    expect(() => resolveApiBaseUrl("http://api.example.com")).toThrow("https");
    expect(resolveApiBaseUrl("http://localhost:8787/")).toBe("http://localhost:8787");
  });

  it("rejects embedded credentials and drops query strings and trailing slashes", () => {
    expect(() => resolveApiBaseUrl("https://user:pass@api.example.com/")).toThrow();
    expect(resolveApiBaseUrl("https://api.example.com/v1/?x=1#y")).toBe(
      "https://api.example.com/v1",
    );
  });
});
