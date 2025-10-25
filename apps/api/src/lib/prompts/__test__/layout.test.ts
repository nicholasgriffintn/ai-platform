import { describe, expect, it } from "vitest";
import { resolvePromptLayout } from "../layout";
import type { PromptCapabilities } from "../utils";

const baseCapabilities: PromptCapabilities = {
  supportsToolCalls: false,
  supportsArtifacts: false,
  supportsReasoning: true,
  requiresThinkingPrompt: false,
};

describe("resolvePromptLayout", () => {
  it("returns full layout when context window is large", () => {
    const layout = resolvePromptLayout({
      contextWindow: 20000,
      isAgent: false,
      isCoding: false,
      capabilities: baseCapabilities,
    });

    expect(layout.metadataFormat).toBe("full");
    expect(layout.principlesFormat).toBe("full");
    expect(layout.instructionVariant).toBe("full");
    expect(layout.exampleVariant).toBe("full");
    expect(layout.artifactExampleVariant).toBe("full");
  });

  it("returns compact sections when context window is mid-sized", () => {
    const layout = resolvePromptLayout({
      contextWindow: 7500,
      isAgent: false,
      isCoding: false,
      capabilities: baseCapabilities,
    });

    expect(layout.metadataFormat).toBe("compact");
    expect(layout.principlesFormat).toBe("compact");
    expect(layout.instructionVariant).toBe("compact");
    expect(layout.exampleVariant).toBe("compact");
    expect(layout.artifactExampleVariant).toBe("compact");
  });

  it("promotes example variant when reasoning traces are unavailable", () => {
    const layout = resolvePromptLayout({
      contextWindow: 3500,
      isAgent: false,
      isCoding: false,
      capabilities: {
        ...baseCapabilities,
        supportsReasoning: false,
      },
    });

    expect(layout.exampleVariant).toBe("compact");
  });

  it("forces compact examples for coding chats when window is tiny", () => {
    const layout = resolvePromptLayout({
      contextWindow: 3000,
      isAgent: false,
      isCoding: true,
      capabilities: baseCapabilities,
    });

    expect(layout.exampleVariant).toBe("compact");
  });

  it("omits examples but keeps full instructions for agents with large windows", () => {
    const layout = resolvePromptLayout({
      contextWindow: 16000,
      isAgent: true,
      isCoding: false,
      capabilities: {
        ...baseCapabilities,
        supportsToolCalls: true,
      },
    });

    expect(layout.exampleVariant).toBe("omit");
    expect(layout.instructionVariant).toBe("full");
  });
});
