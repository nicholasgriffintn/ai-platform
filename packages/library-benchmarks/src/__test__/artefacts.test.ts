import { describe, expect, it } from "vitest";

import { checkHtmlArtefact } from "../artefacts/html.js";
import { checkStrudelCode } from "../artefacts/strudel.js";

const HAMSTER = `<!doctype html><html><head><style>@keyframes spin{to{transform:rotate(1turn)}}</style></head>
<body><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" style="animation:spin 2s linear infinite"/></svg></body></html>`;

describe("hamster HTML gate", () => {
  it("fails files that reach the network or never move", () => {
    expect(
      checkHtmlArtefact(
        HAMSTER.replace("<svg", '<script src="https://evil.test/x.js"></script><svg'),
      ).reasons,
    ).toContain("reaches for the network");
    expect(checkHtmlArtefact("<svg><circle r='4'/></svg>").reasons).toContain("nothing animates");
  });

  it("allows the usual head metadata but not a meta refresh", () => {
    const withMeta = HAMSTER.replace(
      "<head>",
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width">',
    );

    expect(checkHtmlArtefact(withMeta).ok).toBe(true);
    expect(
      checkHtmlArtefact(
        HAMSTER.replace("<head>", '<head><meta http-equiv="refresh" content="0;url=/x">'),
      ).reasons,
    ).toContain("reaches for the network");
  });
});

describe("strudel grammar check", () => {
  it.each([
    ['fetch("https://evil.test")', "unknown function fetch"],
    ['note("c3").constructor.constructor("alert(1)")()', "blocked property constructor"],
    ["note(`${document.cookie}`)", "template strings are not allowed"],
    ['s("bd")["constructor"]', "computed properties are not allowed"],
  ])("rejects %s", (code, reason) => {
    const check = checkStrudelCode(code);

    expect(check.ok).toBe(false);
    expect(check.reasons).toContain(reason);
  });
});
