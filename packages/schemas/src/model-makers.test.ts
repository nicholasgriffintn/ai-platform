import { describe, expect, it } from "vitest";

import { MODEL_MAKERS, findModelMaker, resolveModelMakerId } from "./model-makers";

describe("model makers", () => {
  it("matches a family and every variant that extends it", () => {
    expect(resolveModelMakerId({ family: "claude" })).toBe("anthropic");
    expect(resolveModelMakerId({ family: "claude-opus" })).toBe("anthropic");
    expect(resolveModelMakerId({ family: " Claude-Fable " })).toBe("anthropic");
    expect(resolveModelMakerId({ family: "qwen3.6" })).toBe("qwen");
  });

  it("does not match a family that merely starts with the same letters", () => {
    expect(resolveModelMakerId({ family: "osmosis" })).toBeUndefined();
    expect(resolveModelMakerId({ family: "commandeer" })).toBeUndefined();
  });

  it("prefers the family over the serving provider", () => {
    expect(resolveModelMakerId({ family: "claude-sonnet", provider: "openrouter" })).toBe(
      "anthropic",
    );
    expect(resolveModelMakerId({ family: "gpt-oss", provider: "groq" })).toBe("openai");
  });

  it("falls back to the provider when the family is unknown", () => {
    expect(resolveModelMakerId({ family: "big-pickle", provider: "anthropic" })).toBe("anthropic");
    expect(resolveModelMakerId({ provider: "openrouter" })).toBeUndefined();
    expect(resolveModelMakerId(null)).toBeUndefined();
  });

  it("declares every maker once and resolves it by id", () => {
    const ids = MODEL_MAKERS.map((maker) => maker.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(findModelMaker("ANTHROPIC")?.label).toBe("Anthropic");
    expect(findModelMaker("nothing")).toBeUndefined();
  });
});
