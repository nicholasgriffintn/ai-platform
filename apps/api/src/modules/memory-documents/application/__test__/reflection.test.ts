import type { D1Database } from "@cloudflare/workers-types";
import type { MemoryReflectionTaskData } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { store_memory } from "~/modules/functions/application/memory";
import {
  queueTeammateMemoryCorrection,
  reflectTeammateMemory,
} from "~/modules/memory-documents/application/reflection";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { TaskExecutionContext } from "~/modules/tasks/application/types";
import type { MemoryScope } from "~/types";

import { nativeMemoryUser, nativeMemorySettings } from "../../../../../test/fixtures/native-memory";
import { databaseTestEnvironment } from "../../../../../test/helpers/environment";
import { initialiseNativeMemoryDatabase } from "../../../../../test/helpers/native-memory-database";

const model = vi.hoisted(() => vi.fn());
const prepareModel = vi.hoisted(() => vi.fn());
const gate = vi.hoisted(() => vi.fn());

vi.mock("~/modules/memory/application/gate", () => ({ gateMemoryClassification: gate }));

vi.mock("~/modules/memory-documents/application/reflection-generation", () => ({
  generateMemoryReflection: model,
  prepareMemoryReflection: prepareModel,
}));
vi.mock("~/modules/teammates/application/contexts", () => ({
  requireTeammateContext: vi.fn().mockResolvedValue({
    id: "context",
    memoryDocumentId: "memory",
    scope: { type: "personal", id: "1" },
    homeConversationId: "conversation",
  }),
  getTeammateContextMemory: vi.fn().mockResolvedValue({}),
}));
vi.mock("~/modules/conversations/application/access", () => ({
  requireConversationAccess: vi.fn().mockResolvedValue({ user_id: 1, project_id: null }),
}));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let context: ServiceContext;
const input: MemoryReflectionTaskData = {
  contextId: "context",
  conversationId: "conversation",
  afterMessageId: null,
  throughMessageId: "source",
};
const scope: MemoryScope = {
  type: "bound",
  scopeType: "personal",
  scopeId: "1",
  conversationId: "conversation",
  documents: [{ documentId: "memory", access: "read-write" }],
  teammateContext: { id: "context", memoryDocumentId: "memory" },
};
const execution: TaskExecutionContext = {
  deliveryAttempt: 1,
  isRedelivery: false,
  lease: {
    ownerToken: "owner",
    expiresAt: "2099-01-01T00:00:00.000Z",
    assertOwned: vi.fn().mockResolvedValue(undefined),
  },
};
const correction = {
  edits: [
    {
      before: "Netlify",
      after: "Cloudflare",
      evidence: [{ messageId: "source", quote: "Use Cloudflare now" }],
    },
  ],
  changeNote: "Corrected deployment target",
};

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await initialiseNativeMemoryDatabase(database);
  await database
    .prepare(
      "INSERT INTO conversation_run (id, conversation_id, teammate_context_id, initiator_user_id, trigger) VALUES ('trusted', 'conversation', 'context', 1, 'user')",
    )
    .run();
  const env = databaseTestEnvironment(database);

  context = createServiceContext({ env, user: nativeMemoryUser });
});
beforeEach(async () => {
  vi.restoreAllMocks();
  model.mockReset().mockResolvedValue(correction);
  prepareModel.mockReset().mockResolvedValue({ sourceTokenBudget: 6000 });
  gate.mockReset().mockResolvedValue({ proceed: true, probability: 1 });
  vi.spyOn(context.repositories.users, "getUserById").mockResolvedValue(nativeMemoryUser);
  vi.spyOn(context.repositories.userSettings, "getUserSettings").mockResolvedValue(
    nativeMemorySettings,
  );
  context.setUserSettings(nativeMemorySettings);
  vi.spyOn(TaskService.prototype, "enqueueTask").mockImplementation(async (task) => {
    if (!task.id) {
      throw new Error("A memory task requires an identity");
    }

    await database
      .prepare("INSERT OR IGNORE INTO tasks (id, status, task_data) VALUES (?, 'queued', ?)")
      .bind(task.id, JSON.stringify(task.task_data))
      .run();

    return task.id;
  });
  await database.batch([
    database.prepare("DELETE FROM memory_reflection_result"),
    database.prepare("DELETE FROM memory_reflection_checkpoint"),
    database.prepare("DELETE FROM memory_document_revision WHERE revision > 1"),
    database.prepare("DELETE FROM message"),
    database.prepare("DELETE FROM tasks WHERE id != 'task'"),
    database.prepare(
      "UPDATE tasks SET status = 'running', execution_owner_token = 'owner', execution_lease_expires_at = '2099-01-01T00:00:00.000Z' WHERE id = 'task'",
    ),
    database.prepare("UPDATE teammate_context SET status = 'active'"),
    database.prepare(
      "UPDATE memory_document SET revision = 1, content = 'Deploy to Netlify. Keep concise answers.'",
    ),
    database.prepare(
      "INSERT INTO message (id, conversation_id, run_id, role, content, timestamp) VALUES ('source', 'conversation', 'trusted', 'user', 'Use Cloudflare now', 1)",
    ),
  ]);
});
afterAll(async () => {
  await runtime.dispose();
});

describe("native memory maintenance", () => {
  it("advances an empty source range without model configuration, charges or a redundant revision", async () => {
    await database.prepare("UPDATE message SET content = '  ' WHERE id = 'source'").run();
    prepareModel.mockRejectedValueOnce(new Error("No model configured"));

    expect(await reflectTeammateMemory(context, input, "task", execution)).toBe("no_change");
    expect(
      await context.repositories.memoryDocuments.reflectionCheckpoint("context", "conversation"),
    ).toBe("source");
    expect(model).not.toHaveBeenCalled();
    expect(await context.repositories.memoryDocuments.listRevisions("memory")).toHaveLength(1);
  });
  it("corrects user evidence rather than the memory tool's invented text, once across redelivery", async () => {
    const response = await store_memory.execute(
      { text: "The user invented a completely new preference." },
      {
        env: context.env,
        user: nativeMemoryUser,
        completionId: "conversation",
        request: {
          env: context.env,
          context,
          memoryScope: scope,
          request: {
            input: "Use Cloudflare now",
            date: "2026-10-05",
            completion_id: "conversation",
            run_id: "trusted",
            store: true,
          },
        },
      },
    );
    const taskId = response.data?.taskId;

    if (typeof taskId !== "string") {
      throw new Error("Expected a queued memory correction");
    }

    expect(await context.repositories.memoryDocuments.getDocumentById("memory")).toMatchObject({
      revision: 1,
    });
    await database
      .prepare(
        "UPDATE tasks SET status = 'running', execution_owner_token = 'owner', execution_lease_expires_at = '2099-01-01T00:00:00.000Z' WHERE id = ?",
      )
      .bind(taskId)
      .run();
    const correctionInput = input;

    expect(await reflectTeammateMemory(context, correctionInput, taskId, execution)).toBe(
      "applied",
    );
    expect(await context.repositories.memoryDocuments.getDocumentById("memory")).toMatchObject({
      content: "Deploy to Cloudflare. Keep concise answers.",
      revision: 2,
    });
    expect(
      await context.repositories.memoryDocuments.reflectionCheckpoint("context", "conversation"),
    ).toBe("source");
    await reflectTeammateMemory(context, correctionInput, taskId, {
      ...execution,
      deliveryAttempt: 2,
      isRedelivery: true,
    });
    expect(model).toHaveBeenCalledTimes(1);
    expect(await context.repositories.memoryDocuments.listRevisions("memory")).toHaveLength(2);
  });

  it("queues durable corrections only with fresh consent and rejects revocation during processing", async () => {
    const capture = {
      context,
      scope,
      conversationId: "conversation",
      runId: "trusted",
      classify: true,
    };
    const settings = vi.mocked(context.repositories.userSettings.getUserSettings);

    gate.mockResolvedValueOnce({ proceed: false, probability: 0.05 });
    expect(await queueTeammateMemoryCorrection(capture)).toBeNull();
    settings.mockResolvedValue({ ...nativeMemorySettings, memories_save_enabled: false });
    await expect(queueTeammateMemoryCorrection(capture)).rejects.toMatchObject({ statusCode: 403 });
    settings.mockResolvedValue(nativeMemorySettings);
    const taskId = await queueTeammateMemoryCorrection(capture);

    if (!taskId) {
      throw new Error("Expected a durable correction task");
    }

    await database
      .prepare(
        "UPDATE tasks SET status = 'running', execution_owner_token = 'owner', execution_lease_expires_at = '2099-01-01T00:00:00.000Z' WHERE id = ?",
      )
      .bind(taskId)
      .run();
    model.mockImplementationOnce(async () => {
      settings.mockResolvedValue({ ...nativeMemorySettings, memories_save_enabled: false });

      return correction;
    });
    await expect(reflectTeammateMemory(context, input, taskId, execution)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(
      await context.repositories.memoryDocuments.reflectionCheckpoint("context", "conversation"),
    ).toBeNull();
    expect(await context.repositories.memoryDocuments.getDocumentById("memory")).toMatchObject({
      content: "Deploy to Netlify. Keep concise answers.",
      revision: 1,
    });
  });

  it.each([
    { messageId: "foreign", quote: "Use Cloudflare now" },
    { messageId: "source", quote: "Use AWS" },
  ])(
    "rejects invented source evidence without changing memory or consuming the range",
    async (evidence) => {
      model.mockResolvedValueOnce({
        ...correction,
        edits: [{ before: "Netlify", after: "Cloudflare", evidence: [evidence] }],
      });

      await expect(reflectTeammateMemory(context, input, "task", execution)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(
        await context.repositories.memoryDocuments.reflectionCheckpoint("context", "conversation"),
      ).toBeNull();
      expect(await context.repositories.memoryDocuments.getDocumentById("memory")).toMatchObject({
        content: "Deploy to Netlify. Keep concise answers.",
        revision: 1,
      });
    },
  );

  it("rejects an edit to the cited message while the model is running without consuming the source", async () => {
    model.mockImplementationOnce(async () => {
      await database
        .prepare("UPDATE message SET content = 'Use Netlify instead' WHERE id = 'source'")
        .run();

      return correction;
    });
    await expect(reflectTeammateMemory(context, input, "task", execution)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(
      await context.repositories.memoryDocuments.reflectionCheckpoint("context", "conversation"),
    ).toBeNull();
    expect(await context.repositories.memoryDocuments.getDocumentById("memory")).toMatchObject({
      revision: 1,
    });
  });

  it("preserves a concurrent manual edit and applies the correction after recomputation", async () => {
    model.mockImplementationOnce(async () => {
      await context.repositories.memoryDocuments.appendRevision({
        documentId: "memory",
        expectedRevision: 1,
        createdByUserId: 1,
        content: "Deploy to Netlify. Keep concise answers. Keep deployment reviews.",
      });

      return correction;
    });
    await expect(reflectTeammateMemory(context, input, "task", execution)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(
      await context.repositories.memoryDocuments.reflectionCheckpoint("context", "conversation"),
    ).toBeNull();
    await reflectTeammateMemory(context, input, "task", execution);
    expect(await context.repositories.memoryDocuments.getDocumentById("memory")).toMatchObject({
      content: "Deploy to Cloudflare. Keep concise answers. Keep deployment reviews.",
      revision: 3,
    });
  });
  it.each(["assistant", "tool", "untrusted-user"])(
    "ignores %s output as correction evidence",
    async (sourceKind) => {
      await database
        .prepare("UPDATE message SET role = ?, run_id = NULL WHERE id = 'source'")
        .bind(sourceKind === "untrusted-user" ? "user" : sourceKind)
        .run();

      expect(await reflectTeammateMemory(context, input, "task", execution)).toBe("no_change");
      expect(model).not.toHaveBeenCalled();
      expect(await context.repositories.memoryDocuments.getDocumentById("memory")).toMatchObject({
        revision: 1,
      });
    },
  );

  it.each(["lease", "context"])(
    "atomically rejects a revoked %s at commit without consuming evidence",
    async (boundary) => {
      model.mockImplementationOnce(async () => {
        await database
          .prepare(
            boundary === "lease"
              ? "UPDATE tasks SET execution_owner_token = 'another-worker' WHERE id = 'task'"
              : "UPDATE teammate_context SET status = 'archived' WHERE id = 'context'",
          )
          .run();

        return correction;
      });

      await expect(reflectTeammateMemory(context, input, "task", execution)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(
        await context.repositories.memoryDocuments.reflectionCheckpoint("context", "conversation"),
      ).toBeNull();
      expect(await context.repositories.memoryDocuments.getDocumentById("memory")).toMatchObject({
        revision: 1,
      });
    },
  );
});
