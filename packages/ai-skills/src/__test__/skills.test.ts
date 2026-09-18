import { describe, expect, it } from "vitest";

import {
  formatSkillContent,
  formatSkillResource,
  getSkill,
  getSkillResource,
  isSkillResourceWithinLoadLimit,
  listSkills,
  loadSkill,
  requireSkill,
  SkillCatalog,
} from "../index.js";

describe("ai skills", () => {
  it("retrieves built-in skills by id", () => {
    expect(getSkill("council")?.description).toBeTruthy();
    expect(requireSkill("council").id).toBe("council");
    expect(getSkill("missing")).toBeUndefined();
    expect(() => requireSkill("missing")).toThrow("Unknown skill");
  });

  it("lists and loads skill content and resources", () => {
    expect(listSkills().length).toBeGreaterThan(0);

    const content = loadSkill("artifacts");

    expect(content?.source).toBe("built-in");
    expect(getSkillResource("artifacts", "references/types.md")?.content).toContain("#");
    expect(isSkillResourceWithinLoadLimit({ path: "a", kind: "file", content: "small" })).toBe(
      true,
    );
  });

  it("formats skill content with resource hints and escaping", () => {
    const formatted = formatSkillContent({
      name: "test-skill",
      description: "A test",
      body: "Do the thing.",
      resources: [{ path: "references/a.md", kind: "reference" }],
    });

    expect(formatted).toContain('<skill_content name="test-skill">');
    expect(formatted).toContain("- references/a.md (reference)");

    expect(
      formatSkillResource("test-skill", {
        path: "scripts/x.sh",
        kind: "script",
        content: "echo hi",
      }),
    ).toContain('path="scripts/x.sh"');
  });

  it("builds custom catalogues from documents", () => {
    const catalogue = new SkillCatalog([
      {
        directory: "custom",
        rawContent: "---\nname: custom\ndescription: Custom skill\n---\nInstructions",
        resources: [],
      },
    ]);

    expect(catalogue.getDefinition("custom")?.source).toBe("built-in");
  });
});
