import { describe, expect, it } from "vitest";

import { getDesktopSignInMessage } from "./sign-in-message";

describe("getDesktopSignInMessage", () => {
  it("explains a missing desktop bridge rather than leaking the runtime error", () => {
    expect(
      getDesktopSignInMessage(new Error("Cannot read properties of undefined (reading 'invoke')")),
    ).toMatch(/desktop bridge is not available/);
  });

  it("keeps the reason the core gave for refusing a sign-in", () => {
    expect(getDesktopSignInMessage(new Error("Sign-in timed out."))).toBe("Sign-in timed out.");
  });

  it("falls back to a plain sentence when there is nothing to report", () => {
    expect(getDesktopSignInMessage(new Error(" "))).toBe("Sign-in did not finish. Try again.");
  });
});
