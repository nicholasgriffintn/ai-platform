import { describe, expect, it } from "vitest";

import { getPromptText, getResponseStyle } from "../index.js";

const defaultTraits = getPromptText("chat/response-style/default-traits");

describe("response style choices", () => {
  it("keeps the default traits when nothing is chosen", () => {
    expect(getResponseStyle({}).traits).toBe(defaultTraits);
  });

  it("adds chosen tone and modifiers to the user's own traits instead of replacing them", () => {
    const { traits, preferences } = getResponseStyle({
      userTraits: "Thoughtful",
      userPreferences: "Use British English",
      styleChoices: { tone: "cynical", warmth: "less", emoji: "less", formatting: "default" },
    });

    expect(traits).toMatch(/^dry, sceptical.*matter-of-fact rather than warm, Thoughtful$/);
    expect(preferences).toContain("Do not use emoji");
    expect(preferences).toContain("Use British English");
    expect(preferences).not.toContain("headers");
  });

  it("keeps the assistant's default character when only a modifier is chosen", () => {
    const { traits } = getResponseStyle({ styleChoices: { warmth: "more" } });

    expect(traits).toBe(`${defaultTraits}, warm and caring`);
  });

  it("ignores choices it has no wording for", () => {
    expect(getResponseStyle({ styleChoices: { tone: "unknown" } }).traits).toBe(defaultTraits);
  });
});
