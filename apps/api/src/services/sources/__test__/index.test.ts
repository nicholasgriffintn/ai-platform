import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { MemoryManager } from "~/lib/memory";
import type { SourceCollectionRecord, SourceRecord } from "~/repositories/SourceRepository";

import {
  deleteSource,
  deleteSourceCollection,
  listProjectConversationSources,
  setProjectContextSources,
} from "..";

const deleteMemoryMock = vi.hoisted(() => vi.fn());
const requireProjectAccessMock = vi.hoisted(() => vi.fn());
const recordProjectAuditMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/memory", () => ({
  MemoryManager: {
    getInstance: vi.fn(() => ({ deleteMemory: deleteMemoryMock })),
  },
}));

vi.mock("~/services/workspaces/access", () => ({
  requireProjectAccess: requireProjectAccessMock,
}));

vi.mock("~/services/audit", () => ({
  recordProjectAudit: recordProjectAuditMock,
}));

const memory: SourceRecord = {
  id: "memory-1",
  created_by_user_id: 42,
  project_id: null,
  conversation_id: null,
  connection_id: null,
  kind: "memory",
  title: "Prefers concise answers",
  status: "available",
  content: "The user prefers concise answers.",
  provider: null,
  external_uri: null,
  vector_id: "vector-1",
  metadata: JSON.stringify({ memory_provider: "honcho" }),
  storage_key: null,
  mime_type: null,
  filename: null,
  byte_size: null,
  created_at: "2026-08-11T00:00:00.000Z",
  updated_at: null,
};

describe("source deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMemoryMock.mockResolvedValue(true);
    requireProjectAccessMock.mockResolvedValue({ role: "admin" });
    recordProjectAuditMock.mockResolvedValue(undefined);
  });

  it("deletes personal memories through their recorded provider", async () => {
    const deleteSourceRow = vi.fn();
    const context = {
      env: {},
      user: { id: 42 },
      repositories: {
        sources: {
          getSource: vi.fn().mockResolvedValue(memory),
          deleteSource: deleteSourceRow,
        },
      },
    } as unknown as ServiceContext;

    await deleteSource(context, 42, memory.id);

    expect(MemoryManager.getInstance).toHaveBeenCalledWith(context.env, context.user, context, {
      type: "personal",
    });
    expect(deleteMemoryMock).toHaveBeenCalledWith(memory.id, "honcho");
    expect(deleteSourceRow).not.toHaveBeenCalled();
  });

  it("preserves the source row when its memory provider cannot delete it", async () => {
    deleteMemoryMock.mockResolvedValue(false);
    const deleteSourceRow = vi.fn();
    const context = {
      env: {},
      user: { id: 42 },
      repositories: {
        sources: {
          getSource: vi.fn().mockResolvedValue(memory),
          deleteSource: deleteSourceRow,
        },
      },
    } as unknown as ServiceContext;

    await expect(deleteSource(context, 42, memory.id)).rejects.toMatchObject({
      message: "Memory could not be deleted from its provider",
      statusCode: 502,
    });
    expect(deleteSourceRow).not.toHaveBeenCalled();
  });

  it("uses the built-in provider for migrated memories without provider metadata", async () => {
    const migratedMemory = { ...memory, metadata: JSON.stringify({ migratedFrom: "memories" }) };
    const context = {
      env: {},
      user: { id: 42 },
      repositories: {
        sources: {
          getSource: vi.fn().mockResolvedValue(migratedMemory),
          deleteSource: vi.fn(),
        },
      },
    } as unknown as ServiceContext;

    await deleteSource(context, 42, migratedMemory.id);

    expect(deleteMemoryMock).toHaveBeenCalledWith(migratedMemory.id, "built-in");
  });

  it("deletes project memories through the shared memory provider scope", async () => {
    const projectMemory = {
      ...memory,
      id: "project-memory-1",
      project_id: "project-1",
      metadata: JSON.stringify({ memory_provider: "built-in" }),
    };
    const context = {
      env: {},
      user: { id: 42 },
      repositories: {
        sources: {
          getSource: vi.fn().mockResolvedValue(projectMemory),
        },
      },
    } as unknown as ServiceContext;

    await deleteSource(context, 42, projectMemory.id);

    expect(MemoryManager.getInstance).toHaveBeenCalledWith(context.env, context.user, context, {
      type: "project",
      projectId: "project-1",
    });
    expect(deleteMemoryMock).toHaveBeenCalledWith(projectMemory.id, "built-in");
    expect(recordProjectAuditMock).toHaveBeenCalledWith(
      context,
      "project-1",
      expect.objectContaining({ action: "source.deleted", targetId: projectMemory.id }),
    );
  });
});

describe("project conversation context", () => {
  const projectSource: SourceRecord = {
    ...memory,
    id: "source-1",
    project_id: "project-1",
    kind: "text",
    title: "Launch brief",
    content: "Launch in October.",
    provider: null,
    vector_id: null,
    metadata: "{}",
  };
  const contextCollection: SourceCollectionRecord = {
    id: "project-context:project-1",
    created_by_user_id: 42,
    project_id: "project-1",
    title: "Project context",
    description: "Sources attached to new project conversations.",
    kind: "context",
    created_at: "2026-08-11T00:00:00.000Z",
    updated_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireProjectAccessMock.mockResolvedValue({ role: "admin" });
    recordProjectAuditMock.mockResolvedValue(undefined);
  });

  it("replaces the persistent source set and records the project change", async () => {
    const replaceCollectionSources = vi.fn().mockResolvedValue(undefined);
    const context = {
      env: {},
      user: { id: 42 },
      repositories: {
        sources: {
          getSource: vi.fn().mockResolvedValue(projectSource),
          ensureProjectContextCollection: vi.fn().mockResolvedValue(contextCollection),
          replaceCollectionSources,
          getProjectContextCollection: vi.fn().mockResolvedValue(contextCollection),
          listCollectionSources: vi.fn().mockResolvedValue([projectSource]),
        },
      },
    } as unknown as ServiceContext;

    const result = await setProjectContextSources(context, 42, "project-1", [projectSource.id]);

    expect(requireProjectAccessMock).toHaveBeenCalledWith(context, "project-1", ["owner", "admin"]);
    expect(replaceCollectionSources).toHaveBeenCalledWith(contextCollection.id, [projectSource.id]);
    expect(recordProjectAuditMock).toHaveBeenCalledWith(
      context,
      "project-1",
      expect.objectContaining({ action: "project.context.updated" }),
    );
    expect(result.sources).toEqual([expect.objectContaining({ id: projectSource.id })]);
  });

  it("loads only curated context because project memories use memory retrieval", async () => {
    const memorySource = {
      ...projectSource,
      id: "memory-project-1",
      kind: "memory" as const,
      title: "Launch fact",
    };
    const context = {
      repositories: {
        sources: {
          getProjectContextCollection: vi.fn().mockResolvedValue(contextCollection),
          listProjectSources: vi.fn().mockResolvedValue([memorySource]),
          listCollectionSources: vi
            .fn()
            .mockResolvedValue([projectSource, { ...projectSource, status: "failed" }]),
        },
      },
    } as unknown as ServiceContext;

    const result = await listProjectConversationSources(context, 42, "project-1");

    expect(result.sources).toEqual([
      expect.objectContaining({ id: projectSource.id, content: projectSource.content }),
    ]);
    expect(requireProjectAccessMock).toHaveBeenCalledWith(context, "project-1");
  });

  it("rejects duplicate project context source identifiers", async () => {
    const context = {
      repositories: { sources: { getSource: vi.fn() } },
    } as unknown as ServiceContext;

    await expect(
      setProjectContextSources(context, 42, "project-1", [projectSource.id, projectSource.id]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a source outside the project", async () => {
    const context = {
      env: {},
      user: { id: 42 },
      repositories: {
        sources: {
          getSource: vi.fn().mockResolvedValue({ ...projectSource, project_id: "project-2" }),
          ensureProjectContextCollection: vi.fn(),
          replaceCollectionSources: vi.fn(),
        },
      },
    } as unknown as ServiceContext;

    await expect(
      setProjectContextSources(context, 42, "project-1", [projectSource.id]),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(context.repositories.sources.replaceCollectionSources).not.toHaveBeenCalled();
  });

  it("prevents the reserved project context collection from generic deletion", async () => {
    const deleteCollection = vi.fn();
    const context = {
      env: {},
      user: { id: 42 },
      repositories: {
        sources: {
          getCollection: vi.fn().mockResolvedValue(contextCollection),
          deleteCollection,
        },
      },
    } as unknown as ServiceContext;

    await expect(deleteSourceCollection(context, 42, contextCollection.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(deleteCollection).not.toHaveBeenCalled();
  });
});
