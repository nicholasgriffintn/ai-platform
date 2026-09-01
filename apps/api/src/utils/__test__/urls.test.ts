import { describe, expect, it } from "vitest";

import { appendQueryParams, appendUrlPath, isPrivateHostname, isUrlWithinOrigin } from "../urls";

describe("url utilities", () => {
  it("appends URL paths without duplicate slashes", () => {
    expect(appendUrlPath("https://example.com/base/", "/v1/chat")).toBe(
      "https://example.com/base/v1/chat",
    );
  });

  it("appends query params and skips nullish values", () => {
    const url = new URL("https://example.com/search?existing=true");

    appendQueryParams(url, {
      empty: "",
      page: 2,
      q: "test",
      skipNull: null,
      skipUndefined: undefined,
      tag: ["a", null, "b", undefined],
    });

    expect(url.toString()).toBe(
      "https://example.com/search?existing=true&empty=&page=2&q=test&tag=a&tag=b",
    );
  });

  it("accepts redirect URLs only on the exact allowed origin", () => {
    const origin = "https://app.example.com";

    expect(isUrlWithinOrigin("https://app.example.com/account", origin)).toBe(true);
    expect(isUrlWithinOrigin("https://app.example.com.evil.net/account", origin)).toBe(false);
    expect(isUrlWithinOrigin("https://evil.net/https://app.example.com", origin)).toBe(false);
    expect(isUrlWithinOrigin("https://sub.app.example.com/account", origin)).toBe(false);
    expect(isUrlWithinOrigin("http://app.example.com/account", origin)).toBe(false);
    expect(isUrlWithinOrigin("https://app.example.com:8443/account", origin)).toBe(false);
    expect(isUrlWithinOrigin("javascript:alert(1)", origin)).toBe(false);
    expect(isUrlWithinOrigin("/account", origin)).toBe(false);
    expect(isUrlWithinOrigin("https://app.example.com/account", undefined)).toBe(false);
  });

  it("detects private and local hostnames", () => {
    expect(isPrivateHostname("localhost")).toBe(true);
    expect(isPrivateHostname("localhost.")).toBe(true);
    expect(isPrivateHostname("service.internal")).toBe(true);
    expect(isPrivateHostname("service.localhost")).toBe(true);
    expect(isPrivateHostname("router.home.arpa")).toBe(true);
    expect(isPrivateHostname("printer.local")).toBe(true);
    expect(isPrivateHostname("10.0.0.1")).toBe(true);
    expect(isPrivateHostname("172.16.0.1")).toBe(true);
    expect(isPrivateHostname("192.168.1.10")).toBe(true);
    expect(isPrivateHostname("169.254.1.1")).toBe(true);
    expect(isPrivateHostname("100.64.0.1")).toBe(true);
    expect(isPrivateHostname("100.127.255.255")).toBe(true);
    expect(isPrivateHostname("198.51.100.10")).toBe(true);
    expect(isPrivateHostname("224.0.0.1")).toBe(true);
    expect(isPrivateHostname("[::1]")).toBe(true);
    expect(isPrivateHostname("[fe80::1]")).toBe(true);
    expect(isPrivateHostname("[febf::1]")).toBe(true);
    expect(isPrivateHostname("[fd00::1]")).toBe(true);
    expect(isPrivateHostname("[::ffff:7f00:1]")).toBe(true);
    expect(isPrivateHostname("[::ffff:6440:1]")).toBe(true);
  });

  it("allows public hostnames", () => {
    expect(isPrivateHostname("example.com")).toBe(false);
    expect(isPrivateHostname("8.8.8.8")).toBe(false);
    expect(isPrivateHostname("[2001:4860:4860::8888]")).toBe(false);
  });
});
