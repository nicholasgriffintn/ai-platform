import { afterEach, describe, expect, it } from "vitest";

import {
  getCursorPosition,
  readComposerDom,
  renderComposerDom,
  setCursorPosition,
} from "./composer-input-dom";

afterEach(() => document.body.replaceChildren());

describe("native multiline composer input", () => {
  it.each([
    ["first<div><br></div>", "first\n"],
    ["<div>first</div><div><br></div><div>third</div>", "first\n\nthird"],
    ["<br>", ""],
  ])("preserves empty editable lines in %s", (html, text) => {
    const editable = document.createElement("div");

    editable.innerHTML = html;
    document.body.append(editable);
    expect(readComposerDom(editable).text).toBe(text);
    setCursorPosition(editable, text.length);
    expect(getCursorPosition(editable)).toBe(text.length);
  });
  it.each(["first<br>second<br>third", "first<div>second</div><div>third</div>"])(
    "preserves lines and cursor offsets when inserting a token into %s",
    (html) => {
      const editable = document.createElement("div");

      editable.contentEditable = "true";
      editable.innerHTML = html;
      document.body.append(editable);
      const text = "first\nsecond\nthird";

      expect(readComposerDom(editable).text).toBe(text);
      for (let offset = 0; offset <= text.length; offset += 1) {
        setCursorPosition(editable, offset);
        expect(getCursorPosition(editable)).toBe(offset);
      }

      const token = {
        id: "skill",
        kind: "skill" as const,
        label: "news",
        text: "/news",
        position: text.length + 1,
      };

      renderComposerDom(editable, `${text} /news`, [token]);
      expect(readComposerDom(editable)).toMatchObject({
        text: `${text} /news`,
        tokenPositions: [{ id: "skill", position: text.length + 1 }],
      });
    },
  );
});
