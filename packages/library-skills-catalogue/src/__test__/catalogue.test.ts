import { describe, expect, it } from "vitest";

import {
  getBuiltInSkillResource,
  parseSkillDocument,
  parseUserSkillDocument,
  SkillDocumentError,
} from "../index.js";

describe("built-in skills catalogue", () => {
  it("refuses resource paths outside the skill", () => {
    expect(getBuiltInSkillResource("artifacts", "../secrets")).toBeNull();
  });
});

describe("skill documents", () => {
  it("rejects invalid or reserved documents", () => {
    expect(() => parseSkillDocument("no frontmatter")).toThrow(SkillDocumentError);
    expect(() =>
      parseUserSkillDocument("---\nname: test\nmetadata:\n  polychat-tools: x\n---\nBody"),
    ).toThrow(SkillDocumentError);
    expect(
      parseUserSkillDocument("---\nname: test\ndescription: A test\n---\nBody").frontmatter.name,
    ).toBe("test");
  });
});
