import { describe, expect, it } from "vitest";
import { buildAssistantPrinciplesSection } from "../sections/principles";

describe("buildAssistantPrinciplesSection", () => {
  const baseOptions = {
    isAgent: false,
    supportsToolCalls: false,
    supportsArtifacts: false,
    supportsReasoning: true,
    responseMode: "normal",
    preferredLanguage: null,
  } as const;

  it("produces a full principle set by default", () => {
    const result = buildAssistantPrinciplesSection(baseOptions);

    expect(result).toContain("Start by understanding the user's core intent");
    expect(result).toContain("Proactively suggest useful next steps");
    expect(result).toContain("<assistant_principles>");
    expect(result).toContain("</assistant_principles>");
  });

  it("produces a compact principle set when requested", () => {
    const result = buildAssistantPrinciplesSection({
      ...baseOptions,
      supportsToolCalls: true,
      supportsArtifacts: true,
      supportsReasoning: false,
      format: "compact",
      responseMode: "concise",
      preferredLanguage: "fr",
    });

    expect(result).toContain("Focus on the user's goal");
    expect(result).toContain("Call tools only when they add value");
    expect(result).toContain("Use artifacts for sizeable or reusable work");
    expect(result).toContain(
      "Without native reasoning traces, share a short scratchpad",
    );
    expect(result).toContain("Keep answers tight but complete");
    expect(result).toContain("Default to replying in fr");
    expect(result).not.toContain("Proactively suggest useful next steps");
  });
});
