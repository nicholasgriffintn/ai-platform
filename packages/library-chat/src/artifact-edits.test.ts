import { describe, expect, it } from "vitest";

import {
  applyArtifactEdits,
  createArtifactVersionTracker,
  expandArtifactEdits,
  findLatestArtifactContent,
} from "./artifact-edits";

const edit = (find: string, replace: string) =>
  `<<<<<<< FIND\n${find}\n=======\n${replace}\n>>>>>>> REPLACE`;

describe("applyArtifactEdits", () => {
  it("replaces each found passage in order", () => {
    expect(
      applyArtifactEdits(
        "# Plan\nShip on Monday\nOwner: Sam",
        `${edit("Monday", "Friday")}\n${edit("Sam", "Alex")}`,
      ),
    ).toEqual({ ok: true, content: "# Plan\nShip on Friday\nOwner: Alex" });
  });

  it("refuses an edit whose text is missing or ambiguous", () => {
    expect(applyArtifactEdits("a b", edit("c", "d"))).toMatchObject({ ok: false });
    expect(applyArtifactEdits("a a", edit("a", "b"))).toMatchObject({
      ok: false,
      error: expect.stringContaining("more than one place"),
    });
  });
});

describe("expandArtifactEdits", () => {
  const history = [
    {
      role: "assistant",
      content:
        '<artifact identifier="plan" type="text/markdown" title="Plan">\n# Plan\nShip on Monday\n</artifact>',
    },
  ];
  const tracker = () =>
    createArtifactVersionTracker((identifier) => findLatestArtifactContent(history, identifier));

  it("turns an edit into the full updated artifact", () => {
    const result = expandArtifactEdits(
      `Moved it.\n<artifact identifier="plan" type="text/markdown" title="Plan" mode="edit">\n${edit("Monday", "Friday")}\n</artifact>`,
      tracker(),
    );

    expect(result.changed).toBe(true);
    expect(result.content).toBe(
      'Moved it.\n<artifact identifier="plan" type="text/markdown" title="Plan">\n# Plan\nShip on Friday\n</artifact>',
    );
  });

  it("applies a second edit in the same reply to the first edit's result", () => {
    const result = expandArtifactEdits(
      [
        `<artifact identifier="plan" type="text/markdown" mode="edit">\n${edit("Monday", "Friday")}\n</artifact>`,
        `<artifact identifier="plan" type="text/markdown" mode="edit">\n${edit("Friday", "Saturday")}\n</artifact>`,
      ].join("\n"),
      tracker(),
    );

    expect(result.content).toContain("Ship on Saturday");
    expect(result.failures).toEqual([]);
  });

  it("leaves an edit it cannot apply in place and reports why", () => {
    const original = `<artifact identifier="plan" type="text/markdown" mode="edit">\n${edit("Tuesday", "Friday")}\n</artifact>`;
    const result = expandArtifactEdits(original, tracker());

    expect(result.changed).toBe(false);
    expect(result.content).toBe(original);
    expect(result.failures[0]).toContain("does not contain");
  });
});
