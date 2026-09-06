import { describe, expect, it } from "vitest";

import { describeSource, type ModelSource } from "./ModelSourcePicker";

function source(overrides: Partial<ModelSource>): ModelSource {
  return {
    id: "ollama",
    label: "Ollama",
    location: "device",
    readiness: "ready",
    entries: [{ id: "a", label: "gpt-oss:20b" }],
    ...overrides,
  };
}

describe("describeSource", () => {
  it("counts what a ready source can actually run", () => {
    expect(describeSource(source({}))).toBe("1 available");
  });

  it("says a ready source is empty rather than implying it has models", () => {
    expect(describeSource(source({ entries: [] }))).toBe("No models installed here");
  });

  it("reports why an unready source cannot be used instead of counting it", () => {
    expect(describeSource(source({ readiness: "unavailable", entries: [] }))).toBe("Not running");
    expect(describeSource(source({ readiness: "checking" }))).toBe("Checking");
    expect(describeSource(source({ readiness: "unknown" }))).toBe("Not checked");
  });

  it("prefers a source's own explanation when it has one", () => {
    expect(
      describeSource(source({ readiness: "unavailable", hint: "Start LM Studio to use this" })),
    ).toBe("Start LM Studio to use this");
  });
});
