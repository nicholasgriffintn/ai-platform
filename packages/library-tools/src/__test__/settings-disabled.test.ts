import { describe, expect, it } from "vitest";

import { PermissionChecker } from "../permissions.js";

const checker = new PermissionChecker();
const user = { id: 1, plan_id: "pro" };

describe("tools turned off in settings", () => {
  it("blocks listing, activation and calls for a tool the user turned off", () => {
    const input = {
      toolName: "web_search",
      mode: "chat",
      user,
      settingsDisabledTools: ["web_search"],
    };

    expect(checker.checkToolActivation(input)).toEqual({
      allowed: false,
      reason: `Tool "web_search" is turned off in the user's settings`,
    });
    expect(checker.checkRequestToolAccess(input)).toMatchObject({ allowed: false });
  });

  it("leaves other tools available", () => {
    expect(
      checker.checkRequestToolAccess({
        toolName: "get_weather",
        mode: "chat",
        user,
        settingsDisabledTools: ["web_search"],
      }),
    ).toMatchObject({ allowed: true });
  });
});
