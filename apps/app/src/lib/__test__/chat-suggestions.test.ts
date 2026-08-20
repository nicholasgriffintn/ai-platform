import { describe, expect, it } from "vitest";

import {
  CHAT_SUGGESTION_COUNT,
  createChatSuggestions,
  EMPTY_CHAT_SUGGESTION_CONTEXT,
  type ChatSuggestionContext,
} from "~/lib/chat-suggestions";

function contextWith(overrides: Partial<ChatSuggestionContext> = {}): ChatSuggestionContext {
  return { ...EMPTY_CHAT_SUGGESTION_CONTEXT, ...overrides };
}

describe("createChatSuggestions", () => {
  it("fills the grid from the everyday pool when nothing else is available", () => {
    const suggestions = createChatSuggestions(contextWith(), 0.42);

    expect(suggestions).toHaveLength(CHAT_SUGGESTION_COUNT);
    expect(suggestions.every((suggestion) => suggestion.tier === "everyday")).toBe(true);
    expect(new Set(suggestions.map((suggestion) => suggestion.id)).size).toBe(
      CHAT_SUGGESTION_COUNT,
    );
  });

  it("leads with capabilities, then the focus role, then everyday prompts", () => {
    const suggestions = createChatSuggestions(
      contextWith({
        availableModes: ["live", "background"],
        availableToolIds: ["web_search", "create_image"],
        focusRole: "writing",
      }),
      0.11,
    );

    expect(suggestions.map((suggestion) => suggestion.tier)).toEqual([
      "capability",
      "capability",
      "focus",
      "focus",
    ]);
  });

  it("only offers capabilities the context actually supports", () => {
    const suggestions = createChatSuggestions(
      contextWith({ availableModes: ["live"], availableToolIds: ["web_search"] }),
      0.77,
    );
    const capabilities = suggestions.filter((suggestion) => suggestion.tier === "capability");

    expect(new Set(capabilities.map((suggestion) => suggestion.id))).toEqual(
      new Set(["capability-live", "capability-research"]),
    );
  });

  it("builds connector and recipe suggestions from the person's own setup", () => {
    const suggestions = createChatSuggestions(
      contextWith({
        connectors: [{ id: "gmail", name: "Gmail" }],
        recipes: [{ id: "daily-ai-news-briefing", title: "Daily AI News Briefing" }],
      }),
      0.5,
    );
    const capabilities = suggestions.filter((suggestion) => suggestion.tier === "capability");

    expect(new Set(capabilities.map((suggestion) => suggestion.id))).toEqual(
      new Set(["connector-gmail", "recipe-daily-ai-news-briefing"]),
    );
    expect(
      capabilities.find((suggestion) => suggestion.id === "recipe-daily-ai-news-briefing")?.prompt,
    ).toBe("Run my Daily AI News Briefing recipe.");
  });

  it("falls back to generic copy for connectors without bespoke suggestions", () => {
    const [suggestion] = createChatSuggestions(
      contextWith({ connectors: [{ id: "hindsight", name: "Hindsight" }] }),
      0.3,
    );

    expect(suggestion.label).toBe("Put Hindsight to work");
    expect(suggestion.prompt).toBe("Have a look at my Hindsight and tell me what needs attention.");
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const context = contextWith({ focusRole: "engineering" });
    const ids = (seed: number) =>
      createChatSuggestions(context, seed).map((suggestion) => suggestion.id);

    expect(ids(0.25)).toEqual(ids(0.25));
    expect(ids(0.25)).not.toEqual(ids(0.9));
  });

  it("prefers unseen suggestions when shuffling", () => {
    const context = contextWith();
    const first = createChatSuggestions(context, 0.2);
    const second = createChatSuggestions(context, 0.8, {
      exclude: new Set(first.map((suggestion) => suggestion.id)),
    });

    expect(second).toHaveLength(CHAT_SUGGESTION_COUNT);
    expect(second.some((suggestion) => first.some((seen) => seen.id === suggestion.id))).toBe(
      false,
    );
  });

  it("repeats rather than under-filling once the pools are exhausted", () => {
    const context = contextWith();
    const everything = new Set(
      createChatSuggestions(context, 0.1, { count: 50 }).map((suggestion) => suggestion.id),
    );
    const suggestions = createChatSuggestions(context, 0.6, { exclude: everything });

    expect(suggestions).toHaveLength(CHAT_SUGGESTION_COUNT);
  });

  it("gives mode suggestions an action and no prompt", () => {
    const [suggestion] = createChatSuggestions(contextWith({ availableModes: ["live"] }), 0.4);

    expect(suggestion.action).toEqual({ type: "mode", modeId: "live" });
    expect(suggestion.prompt).toBeUndefined();
  });

  it("arms the tools a capability prompt depends on", () => {
    const [suggestion] = createChatSuggestions(
      contextWith({ availableToolIds: ["create_image"] }),
      0.4,
    );

    expect(suggestion.action).toEqual({ type: "tool", toolIds: ["create_image"] });
    expect(suggestion.prompt).toBeTruthy();
  });
});
