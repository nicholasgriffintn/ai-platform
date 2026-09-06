import { describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";

import { buildSkillDocument, save_skill } from "../save_skill";

const createPersonalSkill = vi.hoisted(() => vi.fn(async () => ({ name: "release-notes" })));
const publishProjectSkill = vi.hoisted(() => vi.fn(async () => ({ name: "release-notes" })));

vi.mock("~/services/skills", () => ({ createPersonalSkill, publishProjectSkill }));

const input = {
  name: "release-notes",
  description: "Use when writing a release note   from a changelog",
  instructions: "Read the changelog, then write the note.",
};

function createToolContext(projectId?: string) {
  const user = { id: 7, plan_id: "pro" };

  return {
    request: {
      env: {},
      user,
      context: { user, requireUser: () => user },
      request: {
        completion_id: "conversation-1",
        metadata: projectId ? { project_id: projectId } : {},
      },
    },
  } as never;
}

describe("save_skill", () => {
  it("writes frontmatter a skill document parser can read back", () => {
    const document = buildSkillDocument(input);

    expect(document.startsWith("---\nname: release-notes\n")).toBe(true);
    expect(document).toContain('description: "Use when writing a release note from a changelog"');
    expect(document.trimEnd().endsWith("Read the changelog, then write the note.")).toBe(true);
  });

  it("saves a personal skill outside a project", async () => {
    const result = await save_skill.execute(input, createToolContext());

    expect(createPersonalSkill).toHaveBeenCalled();
    expect(publishProjectSkill).not.toHaveBeenCalled();
    expect(result.data.scope).toBe("personal");
  });

  it("saves into the project when the conversation belongs to one", async () => {
    const result = await save_skill.execute(input, createToolContext("project-1"));

    expect(publishProjectSkill).toHaveBeenCalledWith(
      expect.anything(),
      7,
      "project-1",
      expect.objectContaining({ content: expect.stringContaining("release-notes") }),
    );
    expect(result.data.scope).toBe("project");
  });

  it("refuses without a signed-in user", async () => {
    await expect(
      save_skill.execute(input, {
        request: { env: {}, request: { completion_id: "conversation-1" } },
      } as never),
    ).rejects.toBeInstanceOf(AssistantError);
  });
});
