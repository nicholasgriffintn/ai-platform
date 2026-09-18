import { describe, expect, it } from "vitest";

import { isAllowedOrigin } from "./origins";

describe("isAllowedOrigin", () => {
  it("lets the packaged desktop window call the API in every environment", () => {
    for (const environment of ["production", "development"]) {
      expect(isAllowedOrigin("tauri://localhost", environment)).toBe(true);
      expect(isAllowedOrigin("http://tauri.localhost", environment)).toBe(true);
    }
  });

  it("lets the desktop renderer call the API while it runs from vite", () => {
    expect(isAllowedOrigin("http://localhost:5183", "development")).toBe(true);
    expect(isAllowedOrigin("http://localhost:5183", "production")).toBe(false);
  });

  it("keeps the web origins it already allowed", () => {
    expect(isAllowedOrigin("http://localhost:5173", "development")).toBe(true);
    expect(isAllowedOrigin("https://polychat.app", "production")).toBe(true);
    expect(isAllowedOrigin("https://polychat.app.evil.test", "production")).toBe(false);
    expect(isAllowedOrigin("", "production")).toBe(false);
    expect(isAllowedOrigin("not a url", "development")).toBe(false);
  });
});
