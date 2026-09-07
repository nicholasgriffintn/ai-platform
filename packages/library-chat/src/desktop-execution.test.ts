import type { DesktopEndpoint } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { findModelRuntimeEndpoint } from "./desktop-execution.js";

function endpoint(overrides: Partial<DesktopEndpoint>): DesktopEndpoint {
  return {
    id: "endpoint-1",
    kind: "model",
    vendor: "ollama",
    label: "Ollama",
    url: "http://127.0.0.1:11434",
    transport: "loopback",
    pairingSecretStored: false,
    approvedAt: "2026-01-01T00:00:00Z",
    lastSeenAt: null,
    ...overrides,
  } as DesktopEndpoint;
}

describe("findModelRuntimeEndpoint", () => {
  it("matches a model runtime by the vendor that serves the model", () => {
    const endpoints = [
      endpoint({ id: "lm", vendor: "lmstudio" }),
      endpoint({ id: "oll", vendor: "ollama" }),
    ];

    expect(findModelRuntimeEndpoint(endpoints, "ollama")?.id).toBe("oll");
    expect(findModelRuntimeEndpoint(endpoints, "lmstudio")?.id).toBe("lm");
  });

  it("never hands back an agent runtime or an unknown vendor", () => {
    const endpoints = [
      endpoint({ id: "agent", kind: "agent", vendor: "hermes" }),
      endpoint({ id: "oll", vendor: "ollama" }),
    ];

    expect(findModelRuntimeEndpoint(endpoints, "hermes")).toBeUndefined();
    expect(findModelRuntimeEndpoint(endpoints, "openai")).toBeUndefined();
    expect(findModelRuntimeEndpoint(endpoints, undefined)).toBeUndefined();
  });
});
