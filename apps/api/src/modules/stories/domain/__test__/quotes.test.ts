import { describe, expect, it } from "vitest";

import { verifyQuote } from "../quotes";

const bodies = [
  {
    articleId: "a1",
    outlet: "BBC News",
    body: "The minister said:  “We will not   back down on this,” before leaving.",
  },
  {
    articleId: "a2",
    outlet: "The Guardian",
    body: "Critics said the plan was ‘rushed and unfunded’ and would fail.",
  },
];

function candidate(text: string, outlet = "BBC News") {
  return { speaker: "The minister", context: "Speaking in Parliament", outlet, text };
}

describe("verifyQuote", () => {
  it("keeps a quote found verbatim in the body, ignoring spacing and quote marks", () => {
    expect(verifyQuote(candidate('"We will not back down on this,"'), bodies)).toMatchObject({
      articleId: "a1",
      text: "We will not back down on this,",
    });
  });

  it("credits the article that actually carries the quote", () => {
    expect(verifyQuote(candidate("the plan was 'rushed and unfunded'"), bodies)).toMatchObject({
      articleId: "a2",
      outlet: "The Guardian",
    });
  });

  it("drops a paraphrase that is not in any body", () => {
    expect(verifyQuote(candidate("We will never back down on this"), bodies)).toBeNull();
  });

  it("drops quotes over forty words", () => {
    const long = Array.from({ length: 41 }, (_, index) => `word${index}`).join(" ");

    expect(
      verifyQuote(candidate(long), [{ articleId: "a3", outlet: "BBC News", body: long }]),
    ).toBeNull();
  });

  it("drops quotes too short to mean anything", () => {
    expect(verifyQuote(candidate("back down"), bodies)).toBeNull();
  });
});
