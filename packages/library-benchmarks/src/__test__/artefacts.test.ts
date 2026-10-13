import { describe, expect, it } from "vitest";

import { extractFencedBlock } from "../answers.js";
import { checkHtmlArtefact, extractHtmlDocument } from "../artefacts/html.js";
import { checkStrudelCode, extractStrudelCode } from "../artefacts/strudel.js";
import { getBenchmark } from "../registry.js";

const HAMSTER = `<!doctype html><html><head><style>@keyframes spin{to{transform:rotate(1turn)}}</style></head>
<body><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" style="animation:spin 2s linear infinite"/></svg></body></html>`;

describe("hamster HTML gate", () => {
  it("extracts the document from a fenced reply and passes a self-contained animation", () => {
    const html = extractHtmlDocument(`Here you go:\n\`\`\`html\n${HAMSTER}\n\`\`\`\nEnjoy.`);

    expect(html).toBe(HAMSTER);
    expect(checkHtmlArtefact(HAMSTER)).toEqual({ ok: true, reasons: [] });
  });

  it("fails files that reach the network or never move", () => {
    expect(
      checkHtmlArtefact(
        HAMSTER.replace("<svg", '<script src="https://evil.test/x.js"></script><svg'),
      ).reasons,
    ).toContain("reaches for the network");
    expect(checkHtmlArtefact("<svg><circle r='4'/></svg>").reasons).toContain("nothing animates");
  });

  it("never hands out an artefact that failed the gate", () => {
    const hamster = getBenchmark("hamster-wheel");

    expect(hamster.artefact("attempt-1", { html: HAMSTER })).toEqual({
      kind: "html",
      content: HAMSTER,
    });
    expect(hamster.artefact("attempt-1", { html: "<p>no hamster</p>" })).toBeNull();
  });
});

describe("fenced block extraction", () => {
  it("prefers the requested language and stays linear on unterminated fences", () => {
    expect(extractFencedBlock("```text\nnope\n```\n```html\n<svg/>\n```", ["html"])).toBe("<svg/>");

    const started = Date.now();

    expect(extractFencedBlock(`\`\`\`\n${"\n ".repeat(200_000)}`, ["html"])).toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe("strudel grammar check", () => {
  it("accepts ordinary layered patterns", () => {
    const code = extractStrudelCode(`\`\`\`js
setcps(0.5)
$: note("c3 [e3 g3] <a3 b3>").s("sawtooth").lpf(800).room(0.4)
$: s("bd*2 [~ sd] hh*4").bank("RolandTR909").gain(0.8) // drums
\`\`\``);

    expect(code).not.toBeNull();
    expect(checkStrudelCode(code ?? "")).toEqual({ ok: true, reasons: [] });
  });

  it.each([
    ['fetch("https://evil.test")', "unknown function fetch"],
    ['note("c3").constructor.constructor("alert(1)")()', "blocked property constructor"],
    ["window.location", "unknown function window"],
    ["note(`${document.cookie}`)", "unsupported character `"],
    ['note("c3").every(4, x => x.fast(2))', "unknown function x"],
    ['s("bd")["constructor"]', "unsupported character ["],
    ['note("c3"); alert(1)', "unsupported character ;"],
  ])("rejects %s", (code, reason) => {
    const check = checkStrudelCode(code);

    expect(check.ok).toBe(false);
    expect(check.reasons).toContain(reason);
  });
});
