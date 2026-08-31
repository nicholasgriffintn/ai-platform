import { readdir, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { builtInSkillDocuments } from "~/data-model/skills";
import { buildSkillsSection } from "~/lib/prompts/sections/skills";
import { toolRegistry } from "~/services/functions";

import { listSkillAvailability } from "../availability";
import {
  SkillCatalog,
  getSkillResource,
  listSkillDefinitions,
  loadSkill,
  type SkillCatalogDocument,
} from "../catalog";
import {
  MAX_USER_SKILL_DOCUMENT_BYTES,
  parseSkillDocument,
  parseUserSkillDocument,
  SkillDocumentError,
  validateSkillResourcePath,
} from "../document";
import {
  createSkillInstructionsResponse,
  createSkillResourceResponse,
  formatSkillContent,
  isSkillResourceWithinLoadLimit,
  MAX_SKILL_RESOURCE_CONTENT_BYTES,
} from "../response";
import { getSkillSuggestedToolNames, mergeSkillSuggestedToolNames } from "../suggested-tools";

const skillsRoot = new URL("../../../data-model/skills/", import.meta.url);

async function readBuiltInSkill(name: string) {
  return readFile(new URL(`${name}/SKILL.md`, skillsRoot), "utf8");
}

function skillDocument(
  directory: string,
  description = "Useful instructions. Load when testing the skill catalogue.",
): SkillCatalogDocument {
  return {
    directory,
    rawContent: `---\nname: ${directory}\ndescription: ${description}\n---\n\n# Instructions`,
    resources: [],
  };
}

const BUILT_IN_SKILL_IDS = [
  "article-analysis",
  "artifacts",
  "council",
  "hacker-news",
  "prompt-craft",
  "recipes",
  "sandbox-tasks",
  "second-opinion",
  "structured-reasoning",
  "task-decomposition",
  "tutoring",
];

describe("built-in skill catalogue", () => {
  it.each(BUILT_IN_SKILL_IDS)("stores %s as an Agent Skills document", async (name) => {
    const raw = await readBuiltInSkill(name);

    expect(raw).toMatch(/^---\n/);
    expect(raw).toContain(`\nname: ${name}\n`);
    expect(raw).toContain("description:");
    expect(raw).toMatch(/\bLoad (when|before)\b/);
    expect(raw).toMatch(/\n---\n\n# /);
  });

  it("stores artifact guidance as relative skill resources", async () => {
    await expect(
      readFile(new URL("artifacts/references/types.md", skillsRoot), "utf8"),
    ).resolves.toContain("# Artifact types");
    await expect(
      readFile(new URL("artifacts/references/design.md", skillsRoot), "utf8"),
    ).resolves.toContain("# Designing visual artifacts");
  });

  it("loads imported Markdown and resources through the catalogue", async () => {
    const skill = await loadSkill("artifacts");
    const resource = await getSkillResource("artifacts", "references/types.md");

    expect(skill).toMatchObject({
      name: "artifacts",
      description: expect.stringContaining("Load when"),
      resources: [
        { path: "references/design.md", kind: "reference" },
        { path: "references/types.md", kind: "reference" },
      ],
    });
    expect(resource).toMatchObject({
      path: "references/types.md",
      encoding: "text",
      mimeType: "text/markdown",
      content: expect.stringContaining("# Artifact types"),
    });
    expect(formatSkillContent(skill)).toContain("- references/types.md (reference)");
  });

  it("keeps loaded instructions in model content without displaying them in chat", async () => {
    const skill = await loadSkill("artifacts");
    const resource = await getSkillResource("artifacts", "references/types.md");

    if (!skill || !resource) {
      throw new Error("Expected the built-in artifacts skill");
    }

    const resources = skill.resources ?? [];
    const skillResponse = createSkillInstructionsResponse(skill, resources);
    const resourceResponse = createSkillResourceResponse("artifacts", resource, resources);

    expect(skillResponse.content).toContain('<skill_content name="artifacts">');
    expect(resourceResponse.content).toContain('<skill_resource skill="artifacts"');
    expect(skillResponse.data).toEqual({
      responseType: "hidden",
      skill: "artifacts",
      resources,
    });
    expect(resourceResponse.data).toEqual({
      responseType: "hidden",
      skill: "artifacts",
      resource: "references/types.md",
      resources,
    });
  });

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

  it("fails fast for duplicate skills, invalid policy, and unsafe resources", () => {
    expect(() => new SkillCatalog([skillDocument("shared"), skillDocument("shared")])).toThrow(
      "duplicate name shared",
    );
    expect(
      () =>
        new SkillCatalog([
          {
            directory: "invalid-policy",
            rawContent:
              '---\nname: invalid-policy\ndescription: Load when testing policy.\nmetadata:\n  polychat-always-on: "sometimes"\n---\n\nBody',
            resources: [],
          },
        ]),
    ).toThrow("must be true or false");
    expect(
      () =>
        new SkillCatalog([
          {
            ...skillDocument("unsafe-resource"),
            resources: [{ path: "../secret.txt", content: "secret" }],
          },
        ]),
    ).toThrow("normalised relative path");
  });

  it("bounds loaded resources", () => {
    expect(
      isSkillResourceWithinLoadLimit({
        path: "references/large.md",
        kind: "reference",
        content: "a".repeat(MAX_SKILL_RESOURCE_CONTENT_BYTES + 1),
      }),
    ).toBe(false);
  });

  it("resolves scope and prompt disclosure from the same catalogue", async () => {
    const personal = await listSkillAvailability({
      scope: "personal",
      modelCapabilities: { supportsToolCalls: true },
      disabledSkillIds: new Set(["council"]),
    });
    const project = await listSkillAvailability({
      scope: "project",
      modelCapabilities: { supportsToolCalls: true },
      enabledSkillIds: new Set(["artifacts"]),
    });

    expect(personal.map(({ id }) => id)).toEqual(BUILT_IN_SKILL_IDS);
    expect(personal.find((skill) => skill.id === "council")?.state).toBe("disabled");
    expect(personal.find((skill) => skill.id === "artifacts")?.state).toBe("ready");
    expect(project.find((skill) => skill.id === "artifacts")?.state).toBe("ready");
    expect(project.find((skill) => skill.id === "council")?.state).toBe("disabled");
    expect(project.find((skill) => skill.id === "recipes")?.state).toBe("ready");

    const prompt = buildSkillsSection(project);

    expect(prompt).toContain("<name>artifacts</name>");
    expect(prompt).toContain("<name>recipes</name>");
    expect(prompt).not.toContain("<name>council</name>");
    expect(prompt).not.toContain("# Artifacts");
  });

  it("registers every skill and resource that exists on disk", async () => {
    const entries = await readdir(new URL(skillsRoot), { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    const registered = builtInSkillDocuments
      .map((document) => document.directory)
      .sort((left, right) => left.localeCompare(right));

    expect(registered).toEqual(directories);

    for (const document of builtInSkillDocuments) {
      const files = await readdir(new URL(`${document.directory}/references/`, skillsRoot), {
        withFileTypes: true,
      }).catch(() => []);
      const onDisk = files
        .filter((file) => file.isFile())
        .map((file) => `references/${file.name}`)
        .sort((left, right) => left.localeCompare(right));

      expect(
        document.resources
          .map((resource) => resource.path)
          .sort((left, right) => left.localeCompare(right)),
      ).toEqual(onDisk);
    }
  });

  it("only requires and suggests tools the registry actually publishes", async () => {
    const registered = new Set(toolRegistry.list().map((tool) => tool.name));
    const declared = (await listSkillDefinitions()).flatMap((skill) => [
      ...skill.requirement.tools,
      ...skill.requirement.suggestedTools,
    ]);

    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((toolId) => !registered.has(toolId))).toEqual([]);
  });

  it("grants a ready skill's suggested tools and ignores a disabled one's", async () => {
    const skills = await listSkillAvailability({
      scope: "personal",
      modelCapabilities: { supportsToolCalls: true },
      disabledSkillIds: new Set(["council"]),
    });

    expect(getSkillSuggestedToolNames(skills)).toContain("web_search");
    expect(getSkillSuggestedToolNames(skills)).not.toContain("run_council");
  });

  it("defers skill tools when the provider can search for them", async () => {
    const skills = await listSkillAvailability({
      scope: "personal",
      modelCapabilities: { supportsToolCalls: true },
    });

    expect(
      mergeSkillSuggestedToolNames({
        enabledTools: ["load_skill", "tool_search"],
        skills,
        deferSuggestedTools: true,
      }),
    ).toEqual(["load_skill", "tool_search"]);
  });

  it("does not let skill suggestions override an explicit tool selection", async () => {
    const skills = await listSkillAvailability({
      scope: "personal",
      modelCapabilities: { supportsToolCalls: true },
    });

    expect(
      mergeSkillSuggestedToolNames({
        enabledTools: ["search_grounding"],
        skills,
        deferSuggestedTools: true,
      }),
    ).toEqual(["search_grounding"]);
  });
});
