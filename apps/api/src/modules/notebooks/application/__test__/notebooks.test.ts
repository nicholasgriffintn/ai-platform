import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { shouldSearchNotebookSources } from "~/modules/notebooks/domain/notebook";
import type { NotebookRecord } from "~/modules/notebooks/infrastructure/NotebookRepository";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { linkNotebookSources, resolveNotebookSources } from "../notebooks";

const notebook: NotebookRecord = {
  id: "notebook-1",
  owner_user_id: 7,
  project_id: null,
  title: "Space",
  normalised_name: "space",
  instructions: null,
  settings: null,
  guide: null,
  created_by_user_id: 7,
  created_at: "2026-10-24T09:00:00.000Z",
  updated_at: null,
};

const requireNotebookAccess = vi.hoisted(() => vi.fn());
const requireSourcesAccess = vi.hoisted(() => vi.fn());

vi.mock("../access", () => ({ requireNotebookAccess }));
vi.mock("~/modules/sources/application/sources", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/sources/application/sources")>()),
  requireSourcesAccess,
}));

function summary(id: string, metadata: Record<string, unknown> = {}) {
  return {
    id,
    created_by_user_id: 7,
    project_id: null,
    conversation_id: null,
    connection_id: null,
    kind: "text",
    title: id,
    status: "available",
    provider: null,
    external_uri: null,
    vector_id: null,
    metadata: JSON.stringify(metadata),
    storage_key: null,
    mime_type: null,
    filename: null,
    byte_size: null,
    created_at: "2026-10-24T09:00:00.000Z",
    updated_at: null,
  };
}

function createContext() {
  const sources = {
    listCollectionSourceSummaries: vi.fn(async () => [
      summary("source-1"),
      summary("note-1", { note: true }),
    ]),
    getSourcesByIds: vi.fn(async (ids: string[]) => ids.map((id) => ({ id, content: "text" }))),
    addCollectionSources: vi.fn(async () => 1),
  };
  const context = {
    requireUser: () => ({ id: 7 }),
    repositories: fakeRepositories([[SourceRepository, sources]]),
  } as unknown as ServiceContext;

  return { context, sources };
}

describe("notebook sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireNotebookAccess.mockResolvedValue({ notebook, canManage: true });
  });

  it("refuses to link a source from somewhere other than the notebook's scope", async () => {
    const { context, sources } = createContext();

    requireSourcesAccess.mockImplementation(
      async (_context, _userId, ids: string[], validate: (source: unknown) => void) => {
        for (const id of ids) {
          validate({ id, project_id: "project-9", created_by_user_id: 7 });
        }
      },
    );

    await expect(linkNotebookSources(context, notebook.id, ["source-9"])).rejects.toThrow(
      /same place as the notebook/,
    );
    expect(sources.addCollectionSources).not.toHaveBeenCalled();
  });

  it("only lets a turn read linked sources, never notes or ids from elsewhere", async () => {
    const { context, sources } = createContext();
    const access = { notebook, canManage: true };

    await expect(
      resolveNotebookSources(context, access, ["note-1", "someone-elses", "source-1"]),
    ).resolves.toEqual([{ id: "source-1", content: "text" }]);
    expect(sources.getSourcesByIds).toHaveBeenCalledWith(["source-1"]);
  });
});

describe("notebook grounding", () => {
  it("inlines sources up to a third of the context window and searches beyond it", () => {
    const atBudget = [{ content: "x".repeat(40_000) }];
    const overBudget = [{ content: "x".repeat(40_001) }];

    expect(shouldSearchNotebookSources(atBudget, 30_000)).toBe(false);
    expect(shouldSearchNotebookSources(overBudget, 30_000)).toBe(true);
  });
});
