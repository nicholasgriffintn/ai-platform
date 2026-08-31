import { describe, expect, it } from "vitest";

import { SkillCatalog } from "~/services/skills/catalog";
import { seedRequestSkillRuntime } from "~/services/skills/runtime-state";

import { load_skill } from "../load_skill";

function createPinnedPersonalSkillRuntime() {
  const requestCache = new Map<string, unknown>();
  let currentSkillId = "internal-skill-1";
  let enabled = true;
  const catalog = new SkillCatalog([
    {
      directory: "release-checklist",
      rawContent:
        "---\nname: release-checklist\ndescription: Check a release before shipping.\n---\n\nPinned instructions",
      trust: "user-authored",
      resources: [{ path: "references/guide.md", content: "Pinned guide" }],
      authored: {
        scope: "personal",
        scopeId: "42",
        skillId: "internal-skill-1",
        revisionId: "revision-7",
        revision: 7,
      },
    },
  ]);
  const user = { id: 42, plan_id: "pro" };
  const context = {
    user,
    requestCache,
    requireUser: () => user,
    repositories: {
      capabilityConfigurations: {
        list: async () => [
          {
            capabilityId: "release-checklist",
            configuration: { enabled },
          },
        ],
      },
      authoredSkills: {
        getByScopeAndName: async () => ({ id: currentSkillId }),
      },
    },
  };
  const request = {
    context,
    user,
    memoryScope: { type: "personal" as const },
    request: { enabled_tools: ["load_skill"] },
  };

  seedRequestSkillRuntime(requestCache, catalog);

  return {
    request,
    requestCache,
    replaceIdentity: () => {
      currentSkillId = "replacement-skill-2";
    },
    revoke: () => {
      enabled = false;
    },
  };
}

function createPinnedProjectSkillRuntime() {
  const requestCache = new Map<string, unknown>();
  let hasMembership = true;
  let hasCapability = true;
  const catalog = new SkillCatalog([
    {
      directory: "release-checklist",
      rawContent:
        "---\nname: release-checklist\ndescription: Check a release before shipping.\n---\n\nProject instructions",
      trust: "user-authored",
      resources: [],
      authored: {
        scope: "project",
        scopeId: "project-1",
        skillId: "internal-skill-1",
        revisionId: "revision-3",
        revision: 3,
      },
    },
  ]);
  const user = { id: 42, plan_id: "pro" };
  const context = {
    user,
    requestCache,
    requireUser: () => user,
    repositories: {
      authoredSkills: {
        getByScopeAndName: async () => ({ id: "internal-skill-1" }),
      },
      workspaces: {
        getProject: async () => ({ id: "project-1", workspace_id: "workspace-1" }),
        getWorkspace: async () => ({ id: "workspace-1" }),
        getMembership: async () => (hasMembership ? { role: "member" } : null),
        listProjectCapabilities: async () =>
          hasCapability ? [{ kind: "skill", capability_id: "release-checklist" }] : [],
      },
    },
  };
  const request = {
    context,
    user,
    memoryScope: { type: "project" as const, projectId: "project-1" },
    request: { enabled_tools: ["load_skill"] },
  };

  seedRequestSkillRuntime(requestCache, catalog);

  return {
    request,
    revokeCapability: () => {
      hasCapability = false;
    },
    revokeMembership: () => {
      hasMembership = false;
    },
  };
}

describe("load_skill", () => {
  it("loads the primary instructions when the model names SKILL.md explicitly", async () => {
    const result = await load_skill.execute({ skill: "artifacts", resource: "SKILL.md" }, {
      request: {},
    } as never);

    expect(result.status).toBe("success");
    expect(result.content).toContain('<skill_content name="artifacts">');
  });

  it("activates document search with the document research instructions", async () => {
    const result = await load_skill.execute({ skill: "document-research" }, {
      request: {},
    } as never);

    expect(result.status).toBe("success");
    expect(result.content).toContain('<skill_content name="document-research">');
    expect(result.data).toMatchObject({
      skill: "document-research",
      activatedTools: ["search_documents"],
    });
  });

  it("loads a pinned authored revision with bounded public provenance", async () => {
    const { request } = createPinnedPersonalSkillRuntime();

    const result = await load_skill.execute({ skill: "release-checklist" }, { request } as never);

    expect(result).toMatchObject({
      status: "success",
      content: expect.stringContaining("Pinned instructions"),
      data: {
        provenance: {
          source: "user-authored",
          scope: "personal",
          skill: "release-checklist",
          revisionId: "revision-7",
          revision: 7,
        },
      },
    });
    expect(new Set(Object.keys(result.data.provenance))).toEqual(
      new Set(["revision", "revisionId", "scope", "skill", "source"]),
    );
  });

  it("rejects a same-name replacement instead of authorising a stale identity", async () => {
    const { replaceIdentity, request } = createPinnedPersonalSkillRuntime();

    replaceIdentity();
    const result = await load_skill.execute({ skill: "release-checklist" }, { request } as never);

    expect(result).toMatchObject({ status: "error", data: { skill: "release-checklist" } });
    expect(result.data).not.toHaveProperty("provenance");
  });

  it("rechecks personal enablement before loading pinned content", async () => {
    const { request, revoke } = createPinnedPersonalSkillRuntime();

    revoke();
    const result = await load_skill.execute({ skill: "release-checklist" }, { request } as never);

    expect(result.status).toBe("error");
    expect(result.data).not.toHaveProperty("provenance");
  });

  it("rechecks the project capability grant before loading pinned content", async () => {
    const { request, revokeCapability } = createPinnedProjectSkillRuntime();

    revokeCapability();
    const result = await load_skill.execute({ skill: "release-checklist" }, { request } as never);

    expect(result.status).toBe("error");
    expect(result.data).not.toHaveProperty("provenance");
  });

  it("rechecks project membership before loading pinned content", async () => {
    const { request, revokeMembership } = createPinnedProjectSkillRuntime();

    revokeMembership();

    await expect(
      load_skill.execute({ skill: "release-checklist" }, { request } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("loads resources from the same pinned revision with the same provenance", async () => {
    const { request } = createPinnedPersonalSkillRuntime();

    const result = await load_skill.execute(
      { skill: "release-checklist", resource: "references/guide.md" },
      { request } as never,
    );

    expect(result).toMatchObject({
      status: "success",
      content: expect.stringContaining("Pinned guide"),
      data: {
        resource: "references/guide.md",
        provenance: {
          source: "user-authored",
          scope: "personal",
          skill: "release-checklist",
          revisionId: "revision-7",
          revision: 7,
        },
      },
    });
  });
});
