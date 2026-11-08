import { buildSkillDocument, SkillCatalog } from "@ngriffin_uk/polychat-library-skills-catalogue";
import { describe, expect, it } from "vitest";

import { listSkillAvailability } from "../availability";
import { listModelInvocableSkills, resolveInvokedSkill, withInvokedSkill } from "../invocation";
import { listPerMessageSkillCandidates } from "../per-message";
import { getSkillSuggestedToolNames, mergeSkillLoadToolName } from "../suggested-tools";

const catalog = new SkillCatalog([
  {
    directory: "deploy",
    rawContent:
      "---\nname: deploy\ndescription: Ship the current branch.\ndisable-model-invocation: true\nmetadata:\n  activation: per-message\n  polychat-suggests-tools: run_deploy\n---\n\nRun the deploy checklist.",
  },
  {
    directory: "house-style",
    rawContent: buildSkillDocument({
      name: "house-style",
      description: "Write in the house style.",
      instructions: "Use British English.",
      activation: "per-message",
      userInvocable: false,
    }),
  },
  {
    directory: "notes",
    rawContent: buildSkillDocument({
      name: "notes",
      description: "Turn rough notes into actions.",
      instructions: "Extract decisions and actions.",
    }),
  },
]);

async function availability() {
  return listSkillAvailability(
    { scope: "personal", modelCapabilities: { supportsToolCalls: true } },
    catalog.listDefinitions(),
  );
}

describe("skill invocation controls", () => {
  it("keeps user-only skills out of everything the model reaches on its own", async () => {
    const skills = await availability();

    expect(listModelInvocableSkills(skills).map((skill) => skill.id)).toEqual([
      "house-style",
      "notes",
    ]);
    expect(listPerMessageSkillCandidates(skills, catalog).map((skill) => skill.id)).toEqual([
      "house-style",
    ]);
    expect(getSkillSuggestedToolNames(skills)).not.toContain("run_deploy");
    expect(
      mergeSkillLoadToolName({
        enabledTools: [],
        skills: skills.filter((skill) => skill.id === "deploy"),
      }),
    ).toEqual([]);
  });

  it("opens a user-only skill to the model for the turn the user invoked it", async () => {
    const skills = await availability();

    expect(listModelInvocableSkills(skills, "deploy").map((skill) => skill.id)).toContain("deploy");
    expect(getSkillSuggestedToolNames(skills, "deploy")).toContain("run_deploy");
    expect(
      mergeSkillLoadToolName({
        enabledTools: [],
        skills: skills.filter((skill) => skill.id === "deploy"),
        invokedSkillId: "deploy",
      }),
    ).toEqual(["load_skill"]);
  });

  it("injects the invoked skill's full instructions ahead of auto-selected ones", async () => {
    const skills = await availability();
    const invoked = resolveInvokedSkill({ invokedSkillId: "deploy", skills, catalog });

    expect(
      withInvokedSkill(invoked, [
        { id: "deploy", name: "deploy", body: "stale" },
        { id: "notes", name: "notes", body: "Extract decisions and actions." },
      ]),
    ).toEqual([
      { id: "deploy", name: "deploy", body: "Run the deploy checklist." },
      { id: "notes", name: "notes", body: "Extract decisions and actions." },
    ]);
    expect(resolveInvokedSkill({ invokedSkillId: undefined, skills, catalog })).toBeNull();
  });

  it("refuses to invoke a skill the user cannot run or that is not ready", async () => {
    const skills = await availability();

    expect(() => resolveInvokedSkill({ invokedSkillId: "house-style", skills, catalog })).toThrow(
      "cannot be used",
    );
    expect(() =>
      resolveInvokedSkill({
        invokedSkillId: "notes",
        skills: skills.map((skill) => ({ ...skill, state: "disabled" as const })),
        catalog,
      }),
    ).toThrow("cannot be used");
    expect(() => resolveInvokedSkill({ invokedSkillId: "missing", skills, catalog })).toThrow(
      "cannot be used",
    );
  });
});
