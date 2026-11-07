import { describe, expect, it } from "vitest";

import { matchesAppKeyboardShortcut } from "./keyboard-shortcuts";

const baseEvent = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

describe("matchesAppKeyboardShortcut", () => {
  it("matches a primary-modifier shortcut", () => {
    expect(matchesAppKeyboardShortcut({ ...baseEvent, key: "k", metaKey: true }, "search")).toBe(
      true,
    );
    expect(matchesAppKeyboardShortcut({ ...baseEvent, key: "K", ctrlKey: true }, "search")).toBe(
      true,
    );
  });

  it("does not match when the key differs", () => {
    expect(matchesAppKeyboardShortcut({ ...baseEvent, key: "x", metaKey: true }, "search")).toBe(
      false,
    );
  });

  it("returns false instead of throwing when the event has no key", () => {
    expect(() =>
      matchesAppKeyboardShortcut({ ...baseEvent, key: undefined }, "open-model-selector"),
    ).not.toThrow();
    expect(matchesAppKeyboardShortcut({ ...baseEvent, key: undefined }, "search")).toBe(false);
    expect(
      matchesAppKeyboardShortcut({ ...baseEvent, key: null, metaKey: true }, "toggle-sidebar"),
    ).toBe(false);
  });
});
