import { describe, expect, it } from "vitest";

import { requireSelfHostedRuntimeUrl } from "../selfHostedRuntime";

describe("requireSelfHostedRuntimeUrl", () => {
  it("accepts an address this deployment could actually reach", () => {
    expect(requireSelfHostedRuntimeUrl("https://ollama.example.com:11434", "Ollama")).toBe(
      "https://ollama.example.com:11434",
    );
    expect(requireSelfHostedRuntimeUrl("https://runtimes.example.com:1234/", "LM Studio")).toBe(
      "https://runtimes.example.com:1234",
    );
  });

  it("refuses the cloud metadata address and other addresses inside the deployment network", () => {
    for (const address of [
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.4:11434",
      "http://172.16.5.5:11434",
      "http://192.168.1.10:11434",
      "http://[fd00::1]:11434",
      "http://nest.local:11434",
    ]) {
      expect(() => requireSelfHostedRuntimeUrl(address, "Ollama")).toThrow(/own network/);
    }
  });

  it("refuses a scheme that is not HTTP", () => {
    expect(() => requireSelfHostedRuntimeUrl("file:///etc/passwd", "Ollama")).toThrow(
      /HTTP or HTTPS/,
    );
  });

  it("refuses an address it cannot read", () => {
    expect(() => requireSelfHostedRuntimeUrl("not a url", "Ollama")).toThrow(/cannot be read/);
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
