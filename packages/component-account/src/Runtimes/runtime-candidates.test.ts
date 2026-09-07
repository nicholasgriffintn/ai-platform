import { describe, expect, it } from "vitest";

import { buildCustomRuntimeCandidate, validateRuntimeCandidate } from "./runtime-candidates.js";

describe("runtime candidates", () => {
  it("rejects a remote address declared as loopback before probing", () => {
    const candidate = buildCustomRuntimeCandidate({
      vendor: "ollama",
      label: "Home server",
      url: "http://10.0.0.4:11434",
      transport: "loopback",
    });

    expect(validateRuntimeCandidate(candidate)).toBe(
      "A loopback endpoint must address a loopback host",
    );
  });

  it("accepts a custom network model runtime over HTTP", () => {
    const candidate = buildCustomRuntimeCandidate({
      vendor: "llamacpp",
      label: "Home server",
      url: "http://10.0.0.4:8080",
      transport: "network",
    });

    expect(validateRuntimeCandidate(candidate)).toBeNull();
  });
});
