import { describe, expect, it } from "vitest";

import { intersectEnabledTools } from "../enabled-tools.js";

describe("intersectEnabledTools", () => {
  it("keeps an explicit request inside the authoritative tool boundary", () => {
    expect(
      intersectEnabledTools(["web_search", "run_sandbox_task"], ["web_search", "send_email"]),
    ).toEqual(["web_search"]);
  });
});
