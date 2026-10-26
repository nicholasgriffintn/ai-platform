import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";
import { SourceRevisionRepository } from "~/modules/sources/infrastructure/SourceRevisionRepository";

import { writeSourceContent } from "../content";

const reviseKnowledgeContent = vi.hoisted(() => vi.fn());

vi.mock("~/modules/knowledge/application/intake/revise", () => ({ reviseKnowledgeContent }));
vi.mock("~/modules/knowledge/application/intake/body", () => ({
  readKnowledgeText: vi.fn(async (_context: unknown, source: SourceRecord) => source.content ?? ""),
}));
vi.mock("~/modules/sources/application/media/metadata", () => ({
  publishSourceChanged: vi.fn(),
}));

function note(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: "note-1",
    created_by_user_id: 7,
    project_id: null,
    conversation_id: null,
    connection_id: null,
    kind: "text",
    title: "Shopping",
    status: "available",
    content: "eggs",
    provider: null,
    external_uri: null,
    vector_id: null,
    metadata: "{}",
    storage_key: null,
    mime_type: null,
    filename: null,
    byte_size: null,
    revision: 3,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

function setup(advanced: number | null) {
  const revisions = {
    recordBaseline: vi.fn(async () => undefined),
    advance: vi.fn(async () => advanced),
  };
  const context = {
    repositories: fakeRepositories([[SourceRevisionRepository, revisions]]),
  } as unknown as ServiceContext;

  return { context, revisions };
}

const write = {
  userId: 7,
  content: "eggs\nmilk",
  title: "Shopping",
  editSession: "session-1234",
  operation: "updated" as const,
};

describe("writeSourceContent", () => {
  beforeEach(() => reviseKnowledgeContent.mockReset());

  it("refuses a save made against an older revision and leaves the text alone", async () => {
    const { context, revisions } = setup(4);

    await expect(
      writeSourceContent(context, note(), { ...write, expectedRevision: 2 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(revisions.advance).not.toHaveBeenCalled();
    expect(reviseKnowledgeContent).not.toHaveBeenCalled();
  });

  it("keeps the first version before the first edit, then saves the session's text", async () => {
    const { context, revisions } = setup(4);

    await writeSourceContent(context, note(), { ...write, expectedRevision: 3 });

    expect(revisions.recordBaseline).toHaveBeenCalledWith(
      "note-1",
      3,
      { title: "Shopping", content: "eggs", userId: 7 },
      "2026-10-01T00:00:00.000Z",
    );
    expect(revisions.advance).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: 3,
        editSession: "session-1234",
        snapshot: { title: "Shopping", content: "eggs\nmilk", userId: 7 },
      }),
    );
    expect(reviseKnowledgeContent).toHaveBeenCalledOnce();
  });

  it("treats losing the race to another save as a conflict", async () => {
    const { context } = setup(null);

    await expect(writeSourceContent(context, note(), write)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(reviseKnowledgeContent).not.toHaveBeenCalled();
  });

  it("bumps the revision of other files without keeping versions of them", async () => {
    const { context, revisions } = setup(4);

    await writeSourceContent(context, note({ kind: "url" }), write);

    expect(revisions.recordBaseline).not.toHaveBeenCalled();
    expect(revisions.advance).toHaveBeenCalledWith(expect.objectContaining({ snapshot: null }));
  });
});
