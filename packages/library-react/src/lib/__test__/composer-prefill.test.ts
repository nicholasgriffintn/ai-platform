import { describe, expect, it } from "vitest";

import {
  buildComposerPrefillHref,
  COMPOSER_PREFILL_MAX_LENGTH,
  readComposerPrefill,
} from "../composer-prefill";

describe("composer prefill links", () => {
  it("escapes a prompt so punctuation survives the round trip", () => {
    const prompt = "Summarise this: what shipped & what did not?";
    const href = buildComposerPrefillHref(prompt);

    expect(readComposerPrefill(new URLSearchParams(href.split("?")[1]))).toBe(prompt);
  });

  it("caps a very long prompt rather than building an unusable link", () => {
    const href = buildComposerPrefillHref("a".repeat(COMPOSER_PREFILL_MAX_LENGTH + 500));
    const read = readComposerPrefill(new URLSearchParams(href.split("?")[1]));

    expect(read).toHaveLength(COMPOSER_PREFILL_MAX_LENGTH);
  });

  it("reads nothing from a link with no prompt, or a blank one", () => {
    expect(readComposerPrefill(new URLSearchParams(""))).toBeNull();
    expect(readComposerPrefill(new URLSearchParams("prompt=%20%20"))).toBeNull();
  });

  it("builds links against a given base path", () => {
    expect(buildComposerPrefillHref("hello", "/chat")).toBe("/chat?prompt=hello");
  });
});
