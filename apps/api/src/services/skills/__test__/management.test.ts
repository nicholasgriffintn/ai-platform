import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { resolveSkillCatalog } from "../catalog";
import { listScopedSkillSummaries } from "../listing";
import {
  createPersonalSkill,
  deletePersonalSkill,
  publishProjectSkill,
  updatePersonalSkill,
} from "../management";
import { formatSkillContent } from "../response";

const requireProjectAccessMock = vi.hoisted(() => vi.fn());
const recordProjectAuditMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/workspaces/access", () => ({
  requireProjectAccess: requireProjectAccessMock,
}));

vi.mock("~/services/audit", () => ({
  recordProjectAudit: recordProjectAuditMock,
}));

const content =
  "---\nname: meeting-notes\ndescription: Turn rough meeting notes into clear decisions and actions.\n---\n\n# Meeting notes\n\nExtract decisions and actions.";

function createBucket() {
  const objects = new Map<
    string,
    { key: string; content: string; customMetadata?: Record<string, string>; uploaded: Date }
  >();
  const head = vi.fn(async (key: string) => objects.get(key) ?? null);
  const get = vi.fn(async (key: string) => {
    const object = objects.get(key);

    return object ? { ...object, text: async () => object.content } : null;
  });
  const put = vi.fn(
    async (
      key: string,
      nextContent: string,
      options?: { customMetadata?: Record<string, string> },
    ) => {
      const object = {
        key,
        content: nextContent,
        customMetadata: options?.customMetadata,
        uploaded: new Date("2026-08-16T10:00:00.000Z"),
      };

      objects.set(key, object);

      return object;
    },
  );
  const list = vi.fn(async ({ prefix = "" }: { prefix?: string } = {}) => ({
    objects: [...objects.values()].filter((object) => object.key.startsWith(prefix)),
    delimitedPrefixes: [],
    truncated: false as const,
  }));
  const deleteObject = vi.fn(async (key: string) => {
    objects.delete(key);
  });

  return { objects, head, get, put, list, delete: deleteObject };
}

function createContext() {
  const bucket = createBucket();
  const workspaces = {
    addProjectCapability: vi.fn().mockResolvedValue(undefined),
    listProjectCapabilities: vi.fn().mockResolvedValue([]),
    removeProjectCapability: vi.fn().mockResolvedValue(undefined),
  };
  const capabilityConfigurations = { save: vi.fn().mockResolvedValue(undefined) };
  const context = {
    env: { PRIVATE_ASSETS_BUCKET: bucket },
    repositories: { workspaces, capabilityConfigurations },
    getLogger: () => ({ error: vi.fn() }),
  } as unknown as ServiceContext;

  return { bucket, capabilityConfigurations, context, workspaces };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireProjectAccessMock.mockResolvedValue({
    project: { id: "project-1", workspace_id: "workspace-1" },
    role: "admin",
  });
  recordProjectAuditMock.mockResolvedValue(undefined);
});

describe("personal skill management", () => {
  it("reports malformed user documents as request errors", async () => {
    const { context } = createContext();

    await expect(
      createPersonalSkill(context, 42, { content: "# Missing frontmatter" }),
    ).rejects.toMatchObject({ statusCode: 400, type: "PARAMS_ERROR" });
  });

  it("validates and stores a personal SKILL.md under the authenticated user's R2 prefix", async () => {
    const { bucket, capabilityConfigurations, context } = createContext();

    const result = await createPersonalSkill(context, 42, { content });

    expect(bucket.put).toHaveBeenCalledWith(
      "skills/users/42/meeting-notes/SKILL.md",
      content,
      expect.objectContaining({
        httpMetadata: { contentType: "text/markdown; charset=utf-8" },
        customMetadata: expect.objectContaining({
          description: "Turn rough meeting notes into clear decisions and actions.",
          createdByUserId: "42",
        }),
      }),
    );
    expect(capabilityConfigurations.save).toHaveBeenCalledWith({
      scope: { type: "user", id: 42 },
      capabilityKind: "skill",
      capabilityId: "meeting-notes",
      configuration: { enabled: true },
    });
    expect(result).toMatchObject({
      id: "meeting-notes",
      name: "meeting-notes",
      scope: { type: "personal" },
      content,
    });
  });

  it("does not let an update change the stable skill name", async () => {
    const { context } = createContext();

    await createPersonalSkill(context, 42, { content });
    const renamed = content.replaceAll("meeting-notes", "renamed-skill");

    await expect(
      updatePersonalSkill(context, 42, "meeting-notes", { content: renamed }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("does not reveal another user's personal skill", async () => {
    const { context } = createContext();

    await createPersonalSkill(context, 42, { content });

    await expect(
      updatePersonalSkill(context, 99, "meeting-notes", { content }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("loads an authored document through the runtime catalogue as untrusted content", async () => {
    const { context } = createContext();

    await createPersonalSkill(context, 42, { content });

    const catalog = await resolveSkillCatalog(context, { type: "personal", id: 42 });
    const loaded = catalog.load("meeting-notes");

    expect(loaded).toMatchObject({ name: "meeting-notes", source: "user-authored" });
    expect(formatSkillContent(loaded)).toContain(
      '<skill_content name="meeting-notes" source="user-authored">',
    );
  });

  it("includes an authored skill in the existing personal capability catalogue", async () => {
    const { context } = createContext();

    await createPersonalSkill(context, 42, { content });

    const skills = await listScopedSkillSummaries(context, 42);

    expect(skills).toContainEqual(
      expect.objectContaining({
        id: "meeting-notes",
        name: "meeting-notes",
        source: "user-authored",
      }),
    );
  });

  it("deletes a personal skill from its authenticated R2 scope", async () => {
    const { bucket, context } = createContext();

    await createPersonalSkill(context, 42, { content });

    await deletePersonalSkill(context, 42, "meeting-notes");

    expect(bucket.delete).toHaveBeenCalledWith("skills/users/42/meeting-notes/SKILL.md");
    expect(await listScopedSkillSummaries(context, 42)).not.toContainEqual(
      expect.objectContaining({ id: "meeting-notes" }),
    );
  });
});

describe("project skill publishing", () => {
  it("publishes to R2 only after an owner or admin check and adds the project grant", async () => {
    const { bucket, context, workspaces } = createContext();

    const result = await publishProjectSkill(context, 42, "project-1", { content });

    expect(requireProjectAccessMock).toHaveBeenCalledWith(context, "project-1", ["owner", "admin"]);
    expect(bucket.put).toHaveBeenCalledWith(
      "skills/projects/project-1/meeting-notes/SKILL.md",
      content,
      expect.any(Object),
    );
    expect(workspaces.addProjectCapability).toHaveBeenCalledWith({
      id: expect.any(String),
      projectId: "project-1",
      kind: "skill",
      capabilityId: "meeting-notes",
      configuration: {},
      createdBy: 42,
    });
    expect(recordProjectAuditMock).toHaveBeenCalledWith(context, "project-1", {
      actorUserId: 42,
      action: "skill.published",
      targetType: "skill",
      targetId: "meeting-notes",
      metadata: { name: "meeting-notes" },
    });
    expect(result.scope).toEqual({ type: "project", projectId: "project-1" });
  });
});
