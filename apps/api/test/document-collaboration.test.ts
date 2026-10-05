import type { D1Database } from "@cloudflare/workers-types";
import {
  platformTeammateId,
  type DocumentComment,
  type Output,
} from "@ngriffin_uk/polychat-schemas";
import { createTextAnchor, generateId } from "@ngriffin_uk/polychat-utility-core";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createDocumentComment,
  listDocumentComments,
  resolveDocumentThread,
} from "~/modules/documents/application/comments";
import { applyDocumentEdit } from "~/modules/documents/application/selection-edits";
import {
  createOutput,
  getOutput,
  listOutputRevisions,
  updateOutput,
} from "~/modules/outputs/application";

import { databaseTestEnvironment } from "./helpers/environment";
import {
  initialiseProjectWorkDatabase,
  projectWorkTestContext,
} from "./helpers/project-work-database";

vi.mock("~/modules/project-tasks/application/attention", () => ({
  reconcileTaskNotifications: vi.fn(async () => undefined),
}));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let owner: ServiceContext;
let member: ServiceContext;
let outsider: ServiceContext;
let document: Output;
const body = "Original passage. Another passage.";

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await initialiseProjectWorkDatabase(database);
  const env = databaseTestEnvironment(database, { allowCacheAccess: true });

  owner = await projectWorkTestContext(env, 1);
  member = await projectWorkTestContext(env, 2);
  outsider = await projectWorkTestContext(env, 3);
});

beforeEach(async () => {
  document = await createOutput(owner, 1, {
    projectId: "project",
    capabilityId: "documents",
    kind: "document",
    title: "Brief",
    status: "ready",
    sensitivity: "internal",
    content: { format: "markdown", body },
  });
});

afterAll(async () => {
  await runtime.dispose();
});

describe("document collaboration against persisted authority and revisions", () => {
  it("lets members discuss a readable document without granting them edit authority", async () => {
    const comment = await createDocumentComment(member, 2, document.id, {
      requestId: generateId(),
      expectedRevision: 1,
      parentId: null,
      anchor: createTextAnchor(body, 0, 16),
      body: "Clarify this passage",
      mentionedTeammateId: null,
    });

    expect((await listDocumentComments(member, 2, document.id)).permissions).toMatchObject({
      canEditDocument: false,
      canResolveAllThreads: false,
    });
    const reply = await createDocumentComment(owner, 1, document.id, {
      requestId: generateId(),
      expectedRevision: 1,
      parentId: comment.id,
      anchor: null,
      body: "Added context",
      mentionedTeammateId: null,
    });

    expect((await listDocumentComments(member, 2, document.id)).comments).toEqual([comment, reply]);
    await expect(
      applyDocumentEdit(member, 2, document.id, {
        sourceRevision: 1,
        anchor: createTextAnchor(body, 0, 16),
        replacement: "New passage",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const resolved = await resolveDocumentThread(member, 2, document.id, comment.id, {
      expectedRevision: 1,
      resolved: true,
    });

    expect(resolved).toMatchObject({ resolved: true, revision: 2 });
    await expect(
      resolveDocumentThread(member, 2, document.id, comment.id, {
        expectedRevision: 1,
        resolved: false,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      await resolveDocumentThread(owner, 1, document.id, comment.id, {
        expectedRevision: 2,
        resolved: false,
      }),
    ).toMatchObject({ resolved: false, revision: 3 });
    await expect(listDocumentComments(outsider, 3, document.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("creates one durable teammate task for retried and concurrent mention requests", async () => {
    const input = {
      requestId: generateId(),
      expectedRevision: 1,
      parentId: null,
      anchor: null,
      body: "Check the claims",
      mentionedTeammateId: platformTeammateId("research"),
    };
    const comments = await Promise.all([
      createDocumentComment(member, 2, document.id, input),
      createDocumentComment(member, 2, document.id, input),
    ]);

    expect(comments[0].id).toBe(comments[1].id);
    const taskId = comments[0].taskId;

    expect(taskId).not.toBeNull();
    expect(
      (
        await database
          .prepare("SELECT COUNT(*) AS count FROM project_task WHERE id = ?")
          .bind(taskId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    expect((await listDocumentComments(owner, 1, document.id)).comments).toHaveLength(1);
    expect(await owner.repositories.projectTasks.getTaskById(taskId ?? "")).toMatchObject({
      status: "backlog",
      runner: { teammateId: input.mentionedTeammateId },
      createdByUserId: 2,
    });
    await expect(
      createDocumentComment(member, 2, document.id, { ...input, body: "Different request" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rolls back a mentioned task when a document revision changes during comment creation", async () => {
    await updateOutput(owner, 1, document.id, {
      expectedRevision: 1,
      content: { format: "markdown", body: "Updated" },
    });
    const id = generateId();
    const taskId = `document-comment:${id}`;
    const comment: DocumentComment = {
      id,
      outputId: document.id,
      parentId: null,
      anchor: null,
      sourceRevision: 1,
      body: "Stale comment",
      authorUserId: 1,
      resolved: false,
      revision: 1,
      mentionedTeammateId: platformTeammateId("research"),
      taskId,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    const effect = owner.repositories.projectTasks.prepareTaskCreation({
      id: taskId,
      projectId: "project",
      workspaceId: "workspace",
      objective: "Check this",
      source: "user",
      createdByUserId: 1,
      position: 1000,
    });

    await expect(
      owner.repositories.documentComments.create(comment, [effect]),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await owner.repositories.projectTasks.getTaskById(taskId)).toBeNull();
    expect(await owner.repositories.documentComments.get(document.id, id, 1)).toBeNull();
  });

  it("applies only the selected passage and refuses to overwrite a newer revision", async () => {
    const proposal = {
      sourceRevision: 1,
      anchor: createTextAnchor(body, 0, 16),
      replacement: "Revised passage",
    };
    const updated = await applyDocumentEdit(owner, 1, document.id, proposal);

    expect(updated.content.body).toBe("Revised passage. Another passage.");
    expect(updated.revision).toBe(2);
    expect((await listOutputRevisions(owner, 1, document.id)).revisions[0].content.body).toBe(body);
    await expect(applyDocumentEdit(owner, 1, document.id, proposal)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect((await getOutput(owner, 1, document.id)).content.body).toBe(updated.content.body);
  });

  it("refuses ambiguous or deleted selections before writing", async () => {
    const repeated = await updateOutput(owner, 1, document.id, {
      expectedRevision: 1,
      content: { format: "markdown", body: "passage and passage" },
    });

    await expect(
      applyDocumentEdit(owner, 1, document.id, {
        sourceRevision: repeated.revision,
        anchor: { quote: "passage", prefix: "", suffix: "" },
        replacement: "Revised",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      applyDocumentEdit(owner, 1, document.id, {
        sourceRevision: repeated.revision,
        anchor: { quote: "deleted passage", prefix: "", suffix: "" },
        replacement: "Revised",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await getOutput(owner, 1, document.id)).revision).toBe(2);
  });

  it("records one audit event when two edits race against the same captured revision", async () => {
    const repository = owner.repositories.outputs;
    const snapshot = await repository.getOutputIncludingDeleting(document.id);

    if (!snapshot) {
      throw new Error("Test document is missing");
    }

    const lookup = vi
      .spyOn(repository, "getOutputIncludingDeleting")
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(snapshot);
    const outcomes = await Promise.allSettled([
      updateOutput(owner, 1, document.id, {
        expectedRevision: 1,
        content: { format: "markdown", body: "First edit" },
      }),
      updateOutput(owner, 1, document.id, {
        expectedRevision: 1,
        content: { format: "markdown", body: "Second edit" },
      }),
    ]);

    lookup.mockRestore();
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(
      (
        await database
          .prepare(
            "SELECT COUNT(*) AS count FROM workspace_audit_record WHERE action = 'output.updated' AND target_id = ?",
          )
          .bind(document.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    expect((await getOutput(owner, 1, document.id)).revision).toBe(2);
  });

  it("checks membership again after revocation and keeps personal discussion private", async () => {
    const personal = await createOutput(owner, 1, {
      capabilityId: "documents",
      kind: "document",
      title: "Private",
      status: "ready",
      sensitivity: "personal",
      content: { format: "markdown", body },
    });

    await expect(listDocumentComments(member, 2, personal.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    const memberDocument = await createOutput(member, 2, {
      projectId: "project",
      capabilityId: "documents",
      kind: "document",
      title: "Member draft",
      status: "ready",
      sensitivity: "internal",
      content: { format: "markdown", body },
    });

    await database
      .prepare("DELETE FROM workspace_member WHERE workspace_id = 'workspace' AND user_id = 2")
      .run();
    await expect(listDocumentComments(member, 2, document.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      member.repositories.outputs.updateOutput(memberDocument.id, {
        expectedRevision: 1,
        updatedByUserId: 2,
        content: { format: "markdown", body: "Write after revocation" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await getOutput(owner, 1, memberDocument.id)).content.body).toBe(body);
  });
});
