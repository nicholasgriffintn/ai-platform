import { describe, expect, it } from "vitest";

import { isAllowedNativeRedirectUri } from "../native";

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
});

describe("desktop loopback redirects", () => {
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
});
