import { describe, expect, it } from "vitest";

import { intersectEnabledTools } from "../enabledTools";

describe("intersectEnabledTools", () => {
  it("keeps an explicit request inside the authoritative tool boundary", () => {
    expect(
      intersectEnabledTools(["web_search", "run_sandbox_task"], ["web_search", "send_email"]),
    ).toEqual(["web_search"]);
  });

  it("uses the authoritative tools when no narrower request is supplied", () => {
    expect(intersectEnabledTools(["web_search"], undefined)).toEqual(["web_search"]);
  });
});
