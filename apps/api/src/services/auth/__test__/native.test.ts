import { describe, expect, it } from "vitest";

import {
  buildNativeRedirectUri,
  isAllowedNativeRedirectUri,
  requireNativeRedirectUri,
} from "../native";

describe("mobile redirects", () => {
  it("allows only the Polychat auth callback paths", () => {
    expect(isAllowedNativeRedirectUri("polychat://auth/callback", "/callback", "mobile")).toBe(
      true,
    );
    expect(isAllowedNativeRedirectUri("polychat://auth/magic-link", "/magic-link", "mobile")).toBe(
      true,
    );
    expect(isAllowedNativeRedirectUri("polychat://auth/magic-link", "/callback", "mobile")).toBe(
      false,
    );
    expect(
      isAllowedNativeRedirectUri("https://polychat.app/auth/callback", "/callback", "mobile"),
    ).toBe(false);
    expect(
      isAllowedNativeRedirectUri(
        "polychat://auth/callback?next=https://example.com",
        "/callback",
        "mobile",
      ),
    ).toBe(false);
    expect(
      isAllowedNativeRedirectUri("polychat://user:pass@auth/callback", "/callback", "mobile"),
    ).toBe(false);
    expect(isAllowedNativeRedirectUri("polychat://evil/callback", "/callback", "mobile")).toBe(
      false,
    );
  });

  it("throws for invalid mobile redirects", () => {
    expect(() =>
      requireNativeRedirectUri("https://example.com/callback", "/callback", "mobile"),
    ).toThrow("Invalid mobile redirect URI");
  });
});

describe("desktop loopback redirects", () => {
  it("allows any high loopback port on the exact callback path", () => {
    expect(
      isAllowedNativeRedirectUri("http://127.0.0.1:49152/callback", "/callback", "desktop"),
    ).toBe(true);
    expect(isAllowedNativeRedirectUri("http://[::1]:52001/callback", "/callback", "desktop")).toBe(
      true,
    );
    expect(
      isAllowedNativeRedirectUri("http://127.0.0.1:49152/magic-link", "/magic-link", "desktop"),
    ).toBe(true);
  });

  it("refuses any host that is not a loopback literal", () => {
    expect(
      isAllowedNativeRedirectUri("http://localhost:49152/callback", "/callback", "desktop"),
    ).toBe(false);
    expect(
      isAllowedNativeRedirectUri("http://10.0.0.4:49152/callback", "/callback", "desktop"),
    ).toBe(false);
    expect(
      isAllowedNativeRedirectUri(
        "http://127.0.0.1.evil.com:49152/callback",
        "/callback",
        "desktop",
      ),
    ).toBe(false);
    expect(
      isAllowedNativeRedirectUri("https://127.0.0.1:49152/callback", "/callback", "desktop"),
    ).toBe(false);
  });

  it("refuses a redirect that smuggles anything past the path", () => {
    expect(
      isAllowedNativeRedirectUri(
        "http://127.0.0.1:49152/callback?next=https://example.com",
        "/callback",
        "desktop",
      ),
    ).toBe(false);
    expect(
      isAllowedNativeRedirectUri(
        "http://user:pass@127.0.0.1:49152/callback",
        "/callback",
        "desktop",
      ),
    ).toBe(false);
    expect(
      isAllowedNativeRedirectUri("http://127.0.0.1:49152/callback#x", "/callback", "desktop"),
    ).toBe(false);
    expect(isAllowedNativeRedirectUri("http://127.0.0.1:49152/other", "/callback", "desktop")).toBe(
      false,
    );
  });

  it("refuses a privileged or absent port", () => {
    expect(isAllowedNativeRedirectUri("http://127.0.0.1:80/callback", "/callback", "desktop")).toBe(
      false,
    );
    expect(isAllowedNativeRedirectUri("http://127.0.0.1/callback", "/callback", "desktop")).toBe(
      false,
    );
  });

  it("does not let a desktop redirect through the mobile rules or the reverse", () => {
    expect(
      isAllowedNativeRedirectUri("http://127.0.0.1:49152/callback", "/callback", "mobile"),
    ).toBe(false);
    expect(isAllowedNativeRedirectUri("polychat://auth/callback", "/callback", "desktop")).toBe(
      false,
    );
  });
});

describe("buildNativeRedirectUri", () => {
  it("appends callback parameters without replacing the redirect target", () => {
    expect(buildNativeRedirectUri("polychat://auth/callback", { code: "abc.123" })).toBe(
      "polychat://auth/callback?code=abc.123",
    );
    expect(buildNativeRedirectUri("http://127.0.0.1:49152/callback", { code: "abc.123" })).toBe(
      "http://127.0.0.1:49152/callback?code=abc.123",
    );
  });
});
