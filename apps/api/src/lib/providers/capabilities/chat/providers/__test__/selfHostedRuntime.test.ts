import { describe, expect, it } from "vitest";

import { requireSelfHostedRuntimeUrl } from "../selfHostedRuntime";

describe("requireSelfHostedRuntimeUrl", () => {
  it("accepts an address this deployment could actually reach", () => {
    expect(requireSelfHostedRuntimeUrl("https://ollama.internal:11434", "Ollama")).toBe(
      "https://ollama.internal:11434",
    );
    expect(requireSelfHostedRuntimeUrl("http://10.0.0.4:1234/", "LM Studio")).toBe(
      "http://10.0.0.4:1234",
    );
  });

  it("refuses a loopback address a deployed Worker can never reach", () => {
    expect(() => requireSelfHostedRuntimeUrl("http://localhost:11434", "Ollama")).toThrow(
      /desktop application/,
    );
    expect(() => requireSelfHostedRuntimeUrl("http://127.0.0.1:1234", "LM Studio")).toThrow(
      /desktop application/,
    );
    expect(() => requireSelfHostedRuntimeUrl("http://[::1]:11434", "Ollama")).toThrow(
      /desktop application/,
    );
  });

  it("refuses to guess when nothing was configured", () => {
    expect(() => requireSelfHostedRuntimeUrl(undefined, "Ollama")).toThrow(/explicit URL/);
    expect(() => requireSelfHostedRuntimeUrl("", "Ollama")).toThrow(/explicit URL/);
  });
});
