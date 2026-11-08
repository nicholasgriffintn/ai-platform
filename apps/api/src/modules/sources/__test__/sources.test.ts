import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import type {
  SourceCollectionRecord,
  SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import {
  addCollectionSources,
  deleteSourceCollection,
  setProjectContextSources,
} from "../application/sources";

const deleteMemoryMock = vi.hoisted(() => vi.fn());
const requireProjectAccessMock = vi.hoisted(() => vi.fn());
const recordProjectAuditMock = vi.hoisted(() => vi.fn());

vi.mock("~/modules/memory/application/manager", () => ({
  MemoryManager: {
    getInstance: vi.fn(() => ({ deleteMemory: deleteMemoryMock })),
  },
}));

vi.mock("~/modules/workspaces/application/access", () => ({
  requireProjectAccess: requireProjectAccessMock,
}));

vi.mock("~/modules/workspaces/application/audit", () => ({
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
  revision: 1,
  created_at: "2026-08-11T00:00:00.000Z",
  updated_at: null,
};

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
    feed_token_hash: null,
    settings: null,
    created_at: "2026-08-11T00:00:00.000Z",
    updated_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireProjectAccessMock.mockResolvedValue({ role: "admin" });
    recordProjectAuditMock.mockResolvedValue(undefined);
  });

  it("rejects a source outside the project", async () => {
    const context = {
      env: {},
      user: { id: 42 },
      repositories: fakeRepositories([
        [
          SourceRepository,
          {
            getSourcesByIds: vi
              .fn()
              .mockResolvedValue([{ ...projectSource, project_id: "project-2" }]),
            ensureProjectContextCollection: vi.fn(),
            replaceCollectionSources: vi.fn(),
          },
        ],
      ]),
    } as unknown as ServiceContext;

    await expect(
      setProjectContextSources(context, 42, "project-1", [projectSource.id]),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(
      context.repositories.get(SourceRepository).replaceCollectionSources,
    ).not.toHaveBeenCalled();
  });

  it("stops a member adding a coworker's source to a podcast show", async () => {
    requireProjectAccessMock.mockResolvedValue({ role: "member" });
    const addCollectionSourcesRepo = vi.fn();
    const context = {
      env: {},
      user: { id: 42 },
      repositories: fakeRepositories([
        [
          SourceRepository,
          {
            getSourcesByIds: vi
              .fn()
              .mockResolvedValue([{ ...projectSource, created_by_user_id: 7 }]),
            addCollectionSources: addCollectionSourcesRepo,
            getCollection: vi.fn().mockResolvedValue({
              id: "show-1",
              project_id: "project-1",
              created_by_user_id: 42,
              kind: "podcast",
            }),
          },
        ],
      ]),
    } as unknown as ServiceContext;

    await expect(
      addCollectionSources(context, 42, "show-1", [projectSource.id]),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(addCollectionSourcesRepo).not.toHaveBeenCalled();
  });

  it("prevents the reserved project context collection from generic deletion", async () => {
    const deleteCollection = vi.fn();
    const context = {
      env: {},
      user: { id: 42 },
      repositories: fakeRepositories([
        [
          SourceRepository,
          {
            getCollection: vi.fn().mockResolvedValue(contextCollection),
            deleteCollection,
          },
        ],
      ]),
    } as unknown as ServiceContext;

    await expect(deleteSourceCollection(context, 42, contextCollection.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(deleteCollection).not.toHaveBeenCalled();
  });
});
