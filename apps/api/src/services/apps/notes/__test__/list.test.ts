import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { getNote } from "../list";

vi.mock("~/services/documents", () => ({
  describeDocument: vi.fn(async () => ({})),
  formatDocumentBody: vi.fn(async () => ""),
}));
vi.mock("~/services/outputs/access", () => ({
  requireOutputRecordAccess: vi.fn(async () => true),
}));

function contextReturning(metadata: Record<string, unknown>) {
  const outputs = {
    getPersonalOutput: vi.fn(async () => ({
      id: "note-1",
      capability_id: "notes",
      kind: "note",
      revision: 1,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: null,
      content: JSON.stringify({ title: "Standup", content: "body", metadata }),
    })),
  };

  return {
    ensureDatabase: vi.fn(),
    repositories: { outputs },
  } as unknown as ServiceContext;
}

describe("getNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads a capture recorded under the old field name", async () => {
    const note = await getNote({
      context: contextReturning({ tabSource: { title: "Standup", url: "https://example.test" } }),
      userId: 4,
      noteId: "note-1",
    });

    expect(note.metadata).toMatchObject({
      capturedFrom: { title: "Standup", url: "https://example.test" },
    });
    expect(note.metadata).not.toHaveProperty("tabSource");
  });

  it("leaves a capture already under the current field name alone", async () => {
    const note = await getNote({
      context: contextReturning({ capturedFrom: { title: "Standup" }, tags: ["standup"] }),
      userId: 4,
      noteId: "note-1",
    });

    expect(note.metadata).toMatchObject({
      capturedFrom: { title: "Standup" },
      tags: ["standup"],
    });
  });

  it("reports no metadata when a note has none", async () => {
    const note = await getNote({
      context: contextReturning(undefined),
      userId: 4,
      noteId: "note-1",
    });

    expect(note.metadata).toBeUndefined();
  });
});
