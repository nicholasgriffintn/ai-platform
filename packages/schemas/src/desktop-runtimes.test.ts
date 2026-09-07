import { describe, expect, it } from "vitest";

import { desktopEndpointSchema } from "./desktop-runtimes.js";

const base = {
  id: "endpoint-1",
  label: "Home server",
  pairingSecretStored: false,
  approvedAt: "2026-09-06T09:00:00.000Z",
  lastSeenAt: null,
};

describe("desktopEndpointSchema", () => {
  it("accepts a loopback model runtime over plain HTTP", () => {
    const result = desktopEndpointSchema.safeParse({
      ...base,
      kind: "model",
      vendor: "ollama",
      url: "http://127.0.0.1:11434",
      transport: "loopback",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a remote host claiming loopback transport", () => {
    const result = desktopEndpointSchema.safeParse({
      ...base,
      kind: "model",
      vendor: "ollama",
      url: "http://10.0.0.4:11434",
      transport: "loopback",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unprotected network agent runtime", () => {
    const result = desktopEndpointSchema.safeParse({
      ...base,
      kind: "agent",
      vendor: "openclaw",
      url: "http://10.0.0.4:18789",
      transport: "network",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a network agent runtime over HTTPS or with a pairing secret", () => {
    const overHttps = desktopEndpointSchema.safeParse({
      ...base,
      kind: "agent",
      vendor: "hermes",
      url: "https://nest.local:18789",
      transport: "network",
    });

    const withPairing = desktopEndpointSchema.safeParse({
      ...base,
      kind: "agent",
      vendor: "hermes",
      url: "http://10.0.0.4:18789",
      transport: "network",
      pairingSecretStored: true,
    });

    expect(overHttps.success).toBe(true);
    expect(withPairing.success).toBe(true);
  });

  it("allows a plain HTTP agent runtime on loopback", () => {
    const result = desktopEndpointSchema.safeParse({
      ...base,
      kind: "agent",
      vendor: "openclaw",
      url: "http://127.0.0.1:18789",
      transport: "loopback",
    });

    expect(result.success).toBe(true);
  });
});
