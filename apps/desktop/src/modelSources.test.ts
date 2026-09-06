import type { DesktopEndpoint, DiscoveredModel } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildModelSources } from "./modelSources";

const endpoint: DesktopEndpoint = {
  id: "ollama-loopback",
  kind: "model",
  vendor: "ollama",
  label: "Ollama",
  url: "http://127.0.0.1:11434",
  transport: "loopback",
  pairingSecretStored: false,
  approvedAt: "1970-01-01T00:00:00Z",
  lastSeenAt: null,
};

const model: DiscoveredModel = {
  endpointId: "ollama-loopback",
  nativeId: "gpt-oss:20b",
  displayName: "gpt-oss:20b",
  contextTokens: 131_072,
  parameterSizeBytes: null,
  capabilities: { tools: false, vision: false, thinking: false },
  loaded: false,
  discoveredAt: "2026-09-06T09:00:00Z",
};

function build(overrides: Partial<Parameters<typeof buildModelSources>[0]> = {}) {
  return buildModelSources({
    endpoints: [endpoint],
    readiness: {},
    models: {},
    checking: null,
    signedIn: false,
    ...overrides,
  });
}

describe("buildModelSources", () => {
  it("always offers cloud alongside the device, and says why it is unusable when signed out", () => {
    const sources = build();
    const cloud = sources.at(-1);

    expect(cloud?.location).toBe("cloud");
    expect(cloud?.readiness).toBe("unavailable");
    expect(cloud?.hint).toBe("Sign in to use cloud models");
  });

  it("makes cloud usable once signed in", () => {
    expect(build({ signedIn: true }).at(-1)?.readiness).toBe("ready");
  });

  it("offers a device model only once its runtime reports ready", () => {
    const unchecked = build({ models: { "ollama-loopback": [model] } });

    expect(unchecked[0]?.readiness).toBe("unknown");

    const ready = build({
      models: { "ollama-loopback": [model] },
      readiness: {
        "ollama-loopback": { status: "ready", checkedAt: "2026-09-06T09:00:00Z", version: null },
      },
    });

    expect(ready[0]?.readiness).toBe("ready");
    expect(ready[0]?.entries[0]?.detail).toBe("131k context");
  });

  it("shows a runtime being checked as checking rather than unavailable", () => {
    expect(build({ checking: "ollama-loopback" })[0]?.readiness).toBe("checking");
  });

  it("explains an unauthorised runtime instead of calling it merely not running", () => {
    const sources = build({
      readiness: {
        "ollama-loopback": {
          status: "unauthorised",
          checkedAt: "2026-09-06T09:00:00Z",
          detail: null,
        },
      },
    });

    expect(sources[0]?.hint).toBe("Needs authorisation");
  });

  it("leaves agent runtimes out of the model picker", () => {
    const sources = build({
      endpoints: [endpoint, { ...endpoint, id: "gateway", kind: "agent", vendor: "openclaw" }],
    });

    expect(sources.filter((entry) => entry.location === "device")).toHaveLength(1);
  });
});
