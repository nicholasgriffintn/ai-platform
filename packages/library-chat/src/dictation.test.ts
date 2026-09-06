import { describe, expect, it } from "vitest";

import { cleanDictatedText } from "./dictation";

describe("cleanDictatedText", () => {
  it("leaves verbatim dictation exactly as spoken", () => {
    const spoken = "um so basically  we need the report,, like tomorrow";

    expect(cleanDictatedText(spoken, "verbatim")).toBe(spoken);
  });

  it("drops fillers and the run-up to the sentence, then fixes the spacing and capitals", () => {
    expect(cleanDictatedText("um so basically we need the report , like tomorrow", "tidy")).toBe(
      "We need the report, tomorrow",
    );
  });

  it("removes a filler that only appears once the one before it has gone", () => {
    expect(cleanDictatedText("um like send it", "tidy")).toBe("Send it");
  });

  it("collapses a word repeated by a stutter", () => {
    expect(cleanDictatedText("send send send the file", "tidy")).toBe("Send the file");
  });

  it("keeps a filler word that is doing real work in the sentence", () => {
    expect(cleanDictatedText("make it look like the old one", "tidy")).toBe(
      "Make it look like the old one",
    );
  });

  it("capitalises every sentence, not only the first", () => {
    expect(cleanDictatedText("open the file. then read it", "tidy")).toBe(
      "Open the file. Then read it",
    );
  });

  it("writes spoken contractions out in full for the professional mode", () => {
    expect(cleanDictatedText("we can't ship it and it's gonna slip", "professional")).toBe(
      "We cannot ship it and it is going to slip",
    );
  });

  it("hands the terminal mode something you can paste into a shell", () => {
    expect(cleanDictatedText("um run the Build script.", "terminal")).toBe("run the build script");
  });

  it("returns nothing for dictation that was nothing but fillers", () => {
    expect(cleanDictatedText("um, uh, erm", "tidy")).toBe("");
  });
});
