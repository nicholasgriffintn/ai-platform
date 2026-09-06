import { describe, expect, it } from "vitest";

import { isLoopbackHostname, isPrivateHostname } from "./private-hosts";

describe("isLoopbackHostname", () => {
  it("recognises the loopback names and addresses", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("app.localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("127.1.2.3")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
  });

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

  it("does not treat neighbouring public ranges as private", () => {
    expect(isPrivateHostname("172.15.0.1")).toBe(false);
    expect(isPrivateHostname("172.32.0.1")).toBe(false);
    expect(isPrivateHostname("192.169.1.1")).toBe(false);
    expect(isPrivateHostname("100.63.0.1")).toBe(false);
    expect(isPrivateHostname("8.8.8.8")).toBe(false);
  });

  it("catches IPv6 link-local and unique-local addresses", () => {
    expect(isPrivateHostname("[fe80::1]")).toBe(true);
    expect(isPrivateHostname("[fd00::1]")).toBe(true);
    expect(isPrivateHostname("[::ffff:127.0.0.1]")).toBe(true);
    expect(isPrivateHostname("[2606:4700::1]")).toBe(false);
  });

  it("catches loopback and local network names", () => {
    expect(isPrivateHostname("localhost")).toBe(true);
    expect(isPrivateHostname("nest.local")).toBe(true);
    expect(isPrivateHostname("ollama.internal")).toBe(false);
  });

  it("does not classify a hostname it cannot resolve as safe by accident", () => {
    expect(isPrivateHostname("10.0.0.4.evil.com")).toBe(false);
  });
});
