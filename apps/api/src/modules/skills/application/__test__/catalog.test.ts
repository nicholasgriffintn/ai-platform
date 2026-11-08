import {
  MAX_USER_SKILL_DOCUMENT_BYTES,
  parseSkillDocument,
  parseUserSkillDocument,
  SkillDocumentError,
  validateSkillResourcePath,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import { describe, expect, it } from "vitest";

describe("built-in skill catalogue", () => {
  it("validates Agent Skills frontmatter and relative paths strictly", () => {
    const raw = `---\nname: valid-skill\ndescription: ${"a".repeat(1024)}\n---\n\n# Instructions`;

    expect(parseSkillDocument(raw, "valid-skill").frontmatter.description).toHaveLength(1024);

    expect(() => parseSkillDocument(raw, "different-directory")).toThrow(SkillDocumentError);
    expect(() =>
      parseSkillDocument(
        `---\nname: invalid--skill\ndescription: Useful instructions.\n---\n\nBody`,
      ),
    ).toThrow(SkillDocumentError);
    expect(() =>
      parseSkillDocument(`---\nname: valid-skill\ndescription: ${"a".repeat(1025)}\n---\n\nBody`),
    ).toThrow(SkillDocumentError);
    expect(validateSkillResourcePath("references/guide.md")).toBeNull();
    expect(validateSkillResourcePath("../secret.txt")).not.toBeNull();
    expect(validateSkillResourcePath("references\\secret.txt")).not.toBeNull();
    expect(validateSkillResourcePath("references/guide\n.md")).not.toBeNull();
    expect(validateSkillResourcePath("a".repeat(513))).not.toBeNull();
  });

  it("rejects untrusted documents that exceed limits or claim product policy", () => {
    expect(() =>
      parseUserSkillDocument(
        `---\nname: policy-override\ndescription: Useful instructions.\nmetadata:\n  polychat-always-on: "true"\n---\n\nBody`,
      ),
    ).toThrow("reserved for built-in skills");

    expect(() =>
      parseUserSkillDocument(
        `---\nname: too-large\ndescription: Useful instructions.\n---\n\n${"a".repeat(MAX_USER_SKILL_DOCUMENT_BYTES)}`,
      ),
    ).toThrow("must be smaller than");
  });
});
