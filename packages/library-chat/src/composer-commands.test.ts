import { describe, expect, it } from "vitest";

import {
  appendComposerInlineTokenWithCursor,
  findComposerInlineTokenRanges,
  getComposerDirectiveQuery,
  matchesComposerCommand,
  removeComposerDirective,
  replaceComposerDirectiveWithCursor,
} from "./composer-commands.js";

describe("composer command parsing", () => {
  it.each([8, 12])(
    "preserves a drafted prompt when selecting a slash command at cursor %i",
    (cursor) => {
      const input = "/hacker-news what's the latest, greatest news?";
      const directive = getComposerDirectiveQuery(input, cursor);

      expect(
        directive &&
          replaceComposerDirectiveWithCursor(input, directive, "/hacker-news", {
            appendTrailingSpace: true,
          }),
      ).toMatchObject({
        input,
        replacementStart: 0,
        replacementEnd: 12,
      });
    },
  );

  it("detects slash commands at the active cursor token", () => {
    const input = "/sandbox implement this";

    expect(getComposerDirectiveQuery(input, 8)).toEqual({
      trigger: "/",
      query: "sandbox",
      start: 0,
      end: 8,
    });
  });

  it("opens a model submenu before a drafted prompt without consuming the prompt", () => {
    const input = "/model Keep this drafted question intact";
    const directive = getComposerDirectiveQuery(input, 3);

    if (!directive) {
      throw new Error("Expected a model directive");
    }

    const selection = replaceComposerDirectiveWithCursor(input, directive, "/model", {
      appendTrailingSpace: true,
    });
    const submenu = getComposerDirectiveQuery(selection.input, selection.cursorPosition);

    expect(submenu?.query).toBe("model ");
    expect(submenu && removeComposerDirective(selection.input, submenu)).toBe(
      "Keep this drafted question intact",
    );
  });

  it("detects agent mentions after whitespace", () => {
    expect(getComposerDirectiveQuery("ask @review", 11)).toEqual({
      trigger: "@",
      query: "review",
      start: 4,
      end: 11,
    });
  });

  it("closes mentions at whitespace but keeps slash directives open across words", () => {
    const mentionInput = "@review do work";
    const slashInput = "/review do work";

    expect(getComposerDirectiveQuery(mentionInput, mentionInput.length)).toBeNull();
    expect(getComposerDirectiveQuery(slashInput, slashInput.length)).not.toBeNull();
  });

  it("ignores completed inline mentions when later words are being typed", () => {
    const input = "hey @Daily Weather and";

    expect(getComposerDirectiveQuery(input, input.length)).toBeNull();
  });

  it("ignores directive text that belongs to a rendered inline token", () => {
    const input = "hey @Daily Weather and";

    expect(
      getComposerDirectiveQuery(input, 5, {
        ignoredRanges: [{ start: 4, end: 18 }],
      }),
    ).toBeNull();
  });

  it("finds selected inline mention ranges in the current prompt text", () => {
    expect(findComposerInlineTokenRanges("hey @Daily Weather and", "Daily Weather")).toEqual([
      { start: 4, end: 18 },
    ]);
  });

  it("removes the active directive without leaking UI syntax into the prompt", () => {
    const input = "/sandbox implement this";
    const directive = getComposerDirectiveQuery(input, 8);

    expect(directive && removeComposerDirective(input, directive)).toBe("implement this");
  });

  it("removes the full directive token when the cursor is inside it", () => {
    const input = "/sandbox implement this";
    const directive = getComposerDirectiveQuery(input, 4);

    expect(directive).toMatchObject({
      trigger: "/",
      query: "san",
      start: 0,
      end: 8,
    });
    expect(directive && removeComposerDirective(input, directive)).toBe("implement this");
  });

  it("removes the full mention token when the cursor is inside it", () => {
    const directive = getComposerDirectiveQuery("ask @reviewer to check this", 8);

    expect(directive).toMatchObject({
      trigger: "@",
      query: "rev",
      start: 4,
      end: 13,
    });
    expect(directive && removeComposerDirective("ask @reviewer to check this", directive)).toBe(
      "ask to check this",
    );
  });

  it("preserves surrounding text when selecting a slash submenu option", () => {
    const input = "Please /model luna explain this\nand keep this line";
    const directive = getComposerDirectiveQuery(input, 16);

    expect(directive).toMatchObject({ query: "model lu", start: 7, end: 18 });
    expect(directive && removeComposerDirective(input, directive)).toBe(
      "Please explain this\nand keep this line",
    );
  });

  it("keeps the prompt after an empty slash submenu query", () => {
    const input = "/model explain this";
    const directive = getComposerDirectiveQuery(input, 7);

    expect(directive).toMatchObject({ query: "model ", start: 0, end: 7 });
    expect(directive && removeComposerDirective(input, directive)).toBe("explain this");
  });

  it("replaces directives and reports the next cursor position", () => {
    const directive = getComposerDirectiveQuery("/r", 2);

    expect(
      directive && replaceComposerDirectiveWithCursor("/r", directive, "/run @"),
    ).toMatchObject({
      input: "/run @",
      cursorPosition: 6,
      replacementStart: 0,
      replacementEnd: 6,
    });
  });

  it("adds a delimiter after inserted one-word mentions", () => {
    const directive = getComposerDirectiveQuery("@po", 3);

    const selection =
      directive &&
      replaceComposerDirectiveWithCursor("@po", directive, "@PostHog", {
        appendTrailingSpace: true,
      });

    expect(selection).toMatchObject({
      input: "@PostHog ",
      cursorPosition: 9,
      replacementStart: 0,
      replacementEnd: 8,
    });
    expect(
      selection && getComposerDirectiveQuery(selection.input, selection.cursorPosition),
    ).toBeNull();
  });

  it("appends inline mentions from compact command selections", () => {
    expect(appendComposerInlineTokenWithCursor("ask", "PostHog")).toEqual({
      input: "ask @PostHog ",
      cursorPosition: 13,
      replacementStart: 4,
      replacementEnd: 12,
    });
  });

  it("matches commands by label, command, or description", () => {
    expect(matchesComposerCommand("sand", ["Sandbox", "sandbox", "Run repository tasks"])).toBe(
      true,
    );
    expect(matchesComposerCommand("team", ["Sandbox", "sandbox", "Run repository tasks"])).toBe(
      false,
    );
  });
});
