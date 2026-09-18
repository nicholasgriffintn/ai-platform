import { readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  builtInSkillDocuments,
  getBuiltInSkillResource,
  listBuiltInSkillDefinitions,
  listBuiltInSkillSummaries,
  loadBuiltInSkill,
  parseSkillDocument,
  parseUserSkillDocument,
  SkillDocumentError,
} from "../index.js";

describe("built-in skills catalogue", () => {
  it("exposes every shipped skill", () => {
    const definitions = listBuiltInSkillDefinitions();

    expect(definitions.length).toBeGreaterThan(0);
    expect(definitions.map((skill) => skill.id)).toContain("artifacts");
    expect(definitions.map((skill) => skill.id)).toContain("council");
    expect(definitions.every((skill) => skill.source === "built-in")).toBe(true);
  });

  it("loads skill content with resources", () => {
    const content = loadBuiltInSkill("artifacts");

    expect(content?.body.length).toBeGreaterThan(0);
    expect(content?.resources?.map((resource) => resource.path)).toEqual([
      "references/design.md",
      "references/types.md",
    ]);
    expect(getBuiltInSkillResource("artifacts", "references/design.md")?.kind).toBe("reference");
    expect(getBuiltInSkillResource("artifacts", "../secrets")).toBeNull();
    expect(loadBuiltInSkill("not-a-skill")).toBeNull();
  });

  it("summarises skills for catalogues", () => {
    const summaries = listBuiltInSkillSummaries();
    const recipes = summaries.find((skill) => skill.id === "recipes");

    expect(recipes?.alwaysOn).toBe(true);
    expect(recipes?.category).toBeTruthy();
  });

  it("covers every raw document", () => {
    expect(builtInSkillDocuments).toHaveLength(listBuiltInSkillDefinitions().length);
  });

  it("registers every skill and resource that exists on disk", async () => {
    const documentsRoot = new URL("../documents/", import.meta.url);
    const entries = await readdir(documentsRoot, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    const registered = builtInSkillDocuments
      .map((document) => document.directory)
      .sort((left, right) => left.localeCompare(right));

    expect(registered).toEqual(directories);

    for (const document of builtInSkillDocuments) {
      const files = await readdir(new URL(`${document.directory}/references/`, documentsRoot), {
        withFileTypes: true,
      }).catch(() => []);
      const onDisk = files
        .filter((file) => file.isFile())
        .map((file) => `references/${file.name}`)
        .sort((left, right) => left.localeCompare(right));

      expect(
        (document.resources ?? [])
          .map((resource) => resource.path)
          .sort((left, right) => left.localeCompare(right)),
      ).toEqual(onDisk);
    }
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
