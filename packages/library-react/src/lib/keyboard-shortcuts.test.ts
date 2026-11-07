import { describe, expect, it } from "vitest";

import { matchesAppKeyboardShortcut } from "./keyboard-shortcuts";

describe("matchesAppKeyboardShortcut", () => {
  it.each([undefined, null])("returns false when the event key is %s", (key) => {
    const event = { altKey: false, ctrlKey: false, key, metaKey: true, shiftKey: false };

    expect(matchesAppKeyboardShortcut(event, "search")).toBe(false);
  });
});
