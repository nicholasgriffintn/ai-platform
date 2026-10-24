import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";

import { requireSubjectInScope, resolveSubjectProjection } from "../subject";

const mocks = vi.hoisted(() => ({
  requireOutputAccess: vi.fn(),
  requireSourceAccess: vi.fn(),
  getConversation: vi.fn(),
}));

vi.mock("~/modules/outputs/application/access", () => ({
  requireOutputAccess: mocks.requireOutputAccess,
}));

vi.mock("~/modules/sources/application/sources", () => ({
  requireSourceAccess: mocks.requireSourceAccess,
}));

function outputRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "output-1",
    created_by_user_id: 7,
    project_id: null,
    conversation_id: null,
    parent_output_id: null,
    capability_id: "documents",
    group_id: null,
    kind: "document",
    title: "Launch brief",
    status: "ready",
    sensitivity: "internal",
    content: JSON.stringify({ format: "markdown", body: "Pricing lands on 4 November." }),
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

const context: ServiceContext = Object.assign(Object.create(null), {
  user: { id: 7 },
  requireUser: () => ({ id: 7 }),
  repositories: fakeRepositories([
    [ConversationRepository, { getConversation: mocks.getConversation }],
    [MemoryDocumentRepository, { getDocumentById: vi.fn() }],
  ]),
});

describe("conversation subjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a file from a different place than the conversation", async () => {
    mocks.requireOutputAccess.mockResolvedValue(outputRecord({ project_id: "project-1" }));

    await expect(
      requireSubjectInScope(context, { type: "output", id: "output-1" }, null),
    ).rejects.toMatchObject({ type: ErrorType.PARAMS_ERROR });
  });

  it("pins the stored subject with its revision and lets the model revise a document", async () => {
    mocks.getConversation.mockResolvedValue({
      id: "conversation-1",
      project_id: null,
      subject_type: "output",
      subject_id: "output-1",
    });
    mocks.requireOutputAccess.mockResolvedValue(outputRecord());

    const projection = await resolveSubjectProjection({
      context,
      conversationId: "conversation-1",
      requested: { type: "source", id: "ignored" },
      requestedProjectId: null,
      contextWindow: 8000,
    });

    expect(mocks.requireSourceAccess).not.toHaveBeenCalled();
    expect(projection.section).toContain("Pricing lands on 4 November.");
    expect(projection.section).toContain("expectedRevision 3");
    expect(projection.document).toEqual({
      id: "output-1",
      kind: "subject",
      revision: 3,
      access: "read",
    });
    expect(projection.tools).toEqual(["write_document"]);
  });

  it("drops a subject the person can no longer read instead of failing the turn", async () => {
    mocks.getConversation.mockResolvedValue({
      id: "conversation-1",
      project_id: "project-1",
      subject_type: "source",
      subject_id: "source-1",
    });
    mocks.requireSourceAccess.mockRejectedValue(
      new AssistantError("Source not found", ErrorType.NOT_FOUND, 404),
    );

    const projection = await resolveSubjectProjection({
      context,
      conversationId: "conversation-1",
      requested: null,
      requestedProjectId: null,
      contextWindow: 8000,
    });

    expect(projection.section).toContain("no longer available");
    expect(projection.document).toBeNull();
    expect(projection.tools).toEqual([]);
  });
});
