import { describe, expect, it } from "vitest";

import { isLoopbackHostname, isPrivateHostname } from "./private-hosts";

describe("isLoopbackHostname", () => {
  it("is not fooled by a name that merely contains one", () => {
    expect(isLoopbackHostname("127.0.0.1.evil.com")).toBe(false);
    expect(isLoopbackHostname("notlocalhost")).toBe(false);
    expect(isLoopbackHostname("example.com")).toBe(false);
  });
});

describe("isPrivateHostname", () => {
  it("catches the cloud metadata address", () => {
    expect(isPrivateHostname("169.254.169.254")).toBe(true);
  });

  it("catches every private IPv4 range a deployment might sit beside", () => {
    expect(isPrivateHostname("10.0.0.4")).toBe(true);
    expect(isPrivateHostname("172.16.0.1")).toBe(true);
    expect(isPrivateHostname("172.31.255.254")).toBe(true);
    expect(isPrivateHostname("192.168.1.1")).toBe(true);
    expect(isPrivateHostname("100.64.0.1")).toBe(true);
    expect(isPrivateHostname("0.0.0.0")).toBe(true);
  });
});
