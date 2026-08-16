import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildSkillsSection } from "~/lib/prompts/sections/skills";
import { listSkillAvailability } from "../availability";
import { SkillCatalog, getSkillResource, loadSkill, type SkillCatalogDocument } from "../catalog";
import { parseSkillDocument, SkillDocumentError, validateSkillResourcePath } from "../document";
import {
	createSkillInstructionsResponse,
	createSkillResourceResponse,
	formatSkillContent,
	isSkillResourceWithinLoadLimit,
	MAX_SKILL_RESOURCE_CONTENT_BYTES,
} from "../response";

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

describe("built-in skill catalogue", () => {
	it.each(["artifacts", "recipes"])("stores %s as an Agent Skills document", async (name) => {
		const raw = await readBuiltInSkill(name);

		expect(raw).toMatch(/^---\n/);
		expect(raw).toContain(`\nname: ${name}\n`);
		expect(raw).toContain("description:");
		expect(raw).toContain("Load when");
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
		expect(formatSkillContent(skill!)).toContain("- references/types.md (reference)");
	});

	it("keeps loaded instructions in model content without displaying them in chat", async () => {
		const skill = await loadSkill("artifacts");
		const resource = await getSkillResource("artifacts", "references/types.md");
		if (!skill || !resource) throw new Error("Expected the built-in artifacts skill");

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
		});
		const project = await listSkillAvailability({
			scope: "project",
			modelCapabilities: { supportsToolCalls: true },
			enabledSkillIds: new Set(["artifacts"]),
		});

		expect(personal.map(({ id, state }) => ({ id, state }))).toEqual([
			{ id: "artifacts", state: "ready" },
			{ id: "recipes", state: "ready" },
		]);
		expect(project.map(({ id, state }) => ({ id, state }))).toEqual([
			{ id: "artifacts", state: "ready" },
			{ id: "recipes", state: "ready" },
		]);
		const prompt = buildSkillsSection(project);
		expect(prompt).toContain("<name>artifacts</name>");
		expect(prompt).toContain("<name>recipes</name>");
		expect(prompt).not.toContain("# Artifacts");
	});
});
