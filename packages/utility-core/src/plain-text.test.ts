import { describe, expect, it } from "vitest";

import { leadParagraphs, markdownToPlainText } from "./plain-text";

const PAGE = `[![Collider logo](https://static0.colliderimages.com/logo.svg "Collider")](/) [Add](https://www.google.com/preferences) [Follow](https://profile.google.com/cp/x) Sign in now

# The 10 Greatest R-Rated Action Masterpieces of the 21st Century, Ranked

![Keanu Reeves](https://static0.colliderimages.com/john-wick.jpg)

[Skip to content](#main-content) * [Join Our Team](/careers/) * [Achievements](/achievements/)

Action cinema has rarely been as inventive as it is right now, and the films on this list prove that the R rating still buys directors the freedom to stage violence with real consequence. From **John Wick** to *The Raid*, these ten films share a commitment to clarity: you always know where everyone is and what it costs them.

Our ranking weighs choreography, stunt work and how well each film holds up on a rewatch, which is why a couple of fan favourites land lower than expected.`;

describe("markdownToPlainText", () => {
  it("removes images, link targets, headings and emphasis but keeps the words", () => {
    const text = markdownToPlainText(PAGE);

    expect(text).not.toContain("](");
    expect(text).not.toContain("![");
    expect(text).toContain(
      "The 10 Greatest R-Rated Action Masterpieces of the 21st Century, Ranked",
    );
    expect(text).toContain("From John Wick to The Raid");
  });
});

describe("leadParagraphs", () => {
  it("starts at the first real paragraph and skips navigation chrome", () => {
    const lead = leadParagraphs(markdownToPlainText(PAGE), 400);

    expect(lead.startsWith("Action cinema has rarely been as inventive")).toBe(true);
    expect(lead).not.toContain("Sign in");
    expect(lead).not.toContain("Skip to content");
    expect(lead.length).toBeLessThanOrEqual(400);
  });

  it("skips an author biography that sits above the article", () => {
    const lead = leadParagraphs(
      "Diego Pineda has been a devout storyteller his whole life. He has self-published a fantasy novel and is actively working on his second, and he writes reviews on his Instagram page dedicated to cinema.\nAction cinema has rarely been as inventive as it is right now, and the films on this list prove that the R rating still buys directors real freedom to stage violence with consequence.",
      400,
    );

    expect(lead.startsWith("Action cinema has rarely been")).toBe(true);
  });

  it("returns nothing when a page is only chrome", () => {
    expect(
      leadParagraphs("Log In · Sign Up\nNever miss a post. Sign up for Instagram.\nMenu", 400),
    ).toBe("");
  });
});
