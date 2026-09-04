import { describe, expect, it } from "vitest";

import {
  replaceAuthoredSkillInstructions,
  splitAuthoredSkillDocument,
} from "./authored-skill-document";

describe("authored skill document editing", () => {
  it("replaces instructions without rewriting frontmatter", () => {
    const original = `---
name: meeting-notes
description: Summarise meetings.
metadata:
  owner: operations
---

# Old instructions
`;

    const updated = replaceAuthoredSkillInstructions(original, "# New instructions");

    expect(splitAuthoredSkillDocument(updated).instructions).toBe("# New instructions");
    expect(updated).toContain("metadata:\n  owner: operations");
  });
});
