import type { D1Database } from "@cloudflare/workers-types";
import {
  nativeRecordDefinitionSchema,
  nativeRecordViewSchema,
  nativeRecordQuerySchema,
  type NativeRecordTable,
} from "@ngriffin_uk/polychat-schemas";
import { createTextAnchor, generateId } from "@ngriffin_uk/polychat-utility-core";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { applyDocumentEdit } from "~/modules/documents/application/selection-edits";
import { createOutput, updateOutput } from "~/modules/outputs/application";
import {
  createNativeRecord,
  updateNativeRecord,
  deleteNativeRecord,
  getNativeRecord,
  listNativeRecords,
  listNativeRecordChanges,
} from "~/modules/records/application/records";
import {
  createNativeRecordTable,
  getNativeRecordTable,
  updateNativeRecordTable,
} from "~/modules/records/application/tables";

import { databaseTestEnvironment } from "./helpers/environment";
import {
  initialiseProjectWorkDatabase,
  projectWorkTestContext,
} from "./helpers/project-work-database";

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
let table: NativeRecordTable;
const definition = nativeRecordDefinitionSchema.parse({
  format: "records",
  visibility: "shared",
  editing: "creator",
  columns: [
    { id: "name", name: "Name", type: "text", required: true },
    { id: "status", name: "Status", type: "select", options: ["Backlog", "Done"], required: true },
    { id: "budget", name: "Budget", type: "number", minimum: 0 },
    { id: "due", name: "Due", type: "date" },
  ],
});

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await initialiseProjectWorkDatabase(database);
  const env = databaseTestEnvironment(database, { allowCacheAccess: true });

  owner = await projectWorkTestContext(env, 1);
  member = await projectWorkTestContext(env, 2);
  outsider = await projectWorkTestContext(env, 3);
});

beforeEach(async () => {
  table = await createNativeRecordTable(owner, {
    title: "Project work",
    projectId: "project",
    definition,
  });
});
afterAll(async () => {
  await runtime.dispose();
});

describe("native records through persisted scope, schema and revision boundaries", () => {
  it("keeps document bindings in their scope and preserves them through text edits", async () => {
    const view = nativeRecordViewSchema.parse({
      id: "project_work",
      tableId: table.output.id,
      title: "Project work",
      presentation: "board",
      groupColumnId: "status",
    });
    const document = await createOutput(owner, 1, {
      projectId: "project",
      capabilityId: "documents",
      kind: "document",
      title: "Plan",
      status: "ready",
      content: { format: "markdown", body: "Original plan", recordViews: [view] },
    });
    const edited = await applyDocumentEdit(owner, 1, document.id, {
      sourceRevision: 1,
      anchor: createTextAnchor("Original plan", 0, 8),
      replacement: "Revised",
    });

    expect(edited.content).toMatchObject({ body: "Revised plan", recordViews: [view] });
    const personal = await createNativeRecordTable(owner, { title: "Personal", definition });

    await expect(
      updateOutput(owner, 1, document.id, {
        expectedRevision: 2,
        content: { ...edited.content, recordViews: [{ ...view, tableId: personal.output.id }] },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      updateOutput(owner, 1, document.id, {
        expectedRevision: 2,
        content: { ...edited.content, recordViews: [{ ...view, groupColumnId: "name" }] },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it("rejects invalid values and treats filter text as data without crossing table scopes", async () => {
    const input = {
      requestId: generateId(),
      tableRevision: 1,
      values: { name: "Research 20%", status: "Backlog", budget: 20 },
    };
    const row = await createNativeRecord(member, table.output.id, input);

    for (const values of [
      { name: "", status: "Backlog" },
      { name: "Plan", status: "Unknown" },
      { name: "Plan", status: "Done", budget: -1 },
      { name: "Plan", status: "Done", due: "2026-02-30" },
      { name: "Plan", status: "Done", undeclared: "value" },
    ]) {
      await expect(
        createNativeRecord(member, table.output.id, { ...input, requestId: generateId(), values }),
      ).rejects.toMatchObject({ statusCode: 400 });
    }

    const matching = await listNativeRecords(
      member,
      table.output.id,
      nativeRecordQuerySchema.parse({
        filters: [{ columnId: "name", operator: "contains", value: "20%" }],
      }),
    );

    expect(matching.records.map((item) => item.id)).toEqual([row.id]);
    const injection = await listNativeRecords(
      member,
      table.output.id,
      nativeRecordQuerySchema.parse({
        filters: [{ columnId: "name", operator: "contains", value: "' OR 1=1--" }],
      }),
    );

    expect(injection.records).toEqual([]);
    await expect(
      listNativeRecords(
        member,
        table.output.id,
        nativeRecordQuerySchema.parse({
          filters: [{ columnId: "unknown", operator: "eq", value: 1 }],
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    const personal = await createNativeRecordTable(owner, { title: "Private", definition });

    await expect(getNativeRecord(member, personal.output.id, row.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(getNativeRecord(owner, personal.output.id, row.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      updateOutput(owner, 1, table.output.id, {
        expectedRevision: 1,
        content: { format: "records", columns: [] },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("deduplicates creation and rejects conflicting edits without emitting phantom changes", async () => {
    const input = {
      requestId: generateId(),
      tableRevision: 1,
      values: { name: "Plan", status: "Backlog" },
    };
    const created = await Promise.all([
      createNativeRecord(member, table.output.id, input),
      createNativeRecord(member, table.output.id, input),
    ]);

    expect(created[0].id).toBe(created[1].id);
    const writes = await Promise.allSettled([
      updateNativeRecord(member, table.output.id, input.requestId, {
        expectedRevision: 1,
        tableRevision: 1,
        values: { name: "Plan A", status: "Done" },
      }),
      updateNativeRecord(member, table.output.id, input.requestId, {
        expectedRevision: 1,
        tableRevision: 1,
        values: { name: "Plan B", status: "Done" },
      }),
    ]);

    expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = writes.find((result) => result.status === "rejected");

    expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({
      statusCode: 409,
    });
    expect((await createNativeRecord(member, table.output.id, input)).revision).toBe(2);
    await expect(
      createNativeRecord(member, table.output.id, {
        ...input,
        values: { name: "Different", status: "Done" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    const feed = await listNativeRecordChanges(member, table.output.id, 0);

    expect(feed.changes.map((change) => change.operation)).toEqual(["created", "updated"]);
    await deleteNativeRecord(member, table.output.id, input.requestId, {
      expectedRevision: 2,
      tableRevision: 1,
    });
    const resumed = await listNativeRecordChanges(member, table.output.id, feed.nextCursor);

    expect(resumed.changes).toHaveLength(1);
    expect(resumed.changes[0]).toMatchObject({
      operation: "deleted",
      revision: 3,
      record: { values: feed.changes[1].record.values, deletedAt: expect.any(String) },
    });
    expect(
      (await listNativeRecords(member, table.output.id, nativeRecordQuerySchema.parse({}))).records,
    ).toEqual([]);
    expect((await getNativeRecordTable(owner, table.output.id)).output.revision).toBe(1);
  });

  it("filters private rows and their history and rechecks membership at the database read", async () => {
    table = await updateNativeRecordTable(owner, table.output.id, {
      expectedRevision: 1,
      definition: { ...definition, visibility: "creator" },
    });
    const own = await createNativeRecord(member, table.output.id, {
      requestId: generateId(),
      tableRevision: 2,
      values: { name: "Member's plan", status: "Done" },
    });

    await createNativeRecord(owner, table.output.id, {
      requestId: generateId(),
      tableRevision: 2,
      values: { name: "Owner's plan", status: "Backlog" },
    });
    expect(
      (
        await listNativeRecords(member, table.output.id, nativeRecordQuerySchema.parse({}))
      ).records.map((row) => row.id),
    ).toEqual([own.id]);
    expect(
      (await listNativeRecordChanges(member, table.output.id, 0)).changes.map(
        (change) => change.recordId,
      ),
    ).toEqual([own.id]);
    expect(
      (await listNativeRecords(owner, table.output.id, nativeRecordQuerySchema.parse({}))).records,
    ).toHaveLength(2);
    await expect(
      listNativeRecords(outsider, table.output.id, nativeRecordQuerySchema.parse({})),
    ).rejects.toMatchObject({ statusCode: 404 });
    const list = member.repositories.nativeRecords.list.bind(member.repositories.nativeRecords);
    const revokeDuringRead = vi
      .spyOn(member.repositories.nativeRecords, "list")
      .mockImplementationOnce(async (...args) => {
        await database
          .prepare("DELETE FROM workspace_member WHERE workspace_id = 'workspace' AND user_id = 2")
          .run();

        return list(...args);
      });

    try {
      await expect(
        listNativeRecords(member, table.output.id, nativeRecordQuerySchema.parse({})),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(listNativeRecordChanges(member, table.output.id, 0)).rejects.toMatchObject({
        statusCode: 404,
      });
    } finally {
      revokeDuringRead.mockRestore();
      await database
        .prepare(
          "INSERT INTO workspace_member (workspace_id, user_id, role) VALUES ('workspace', 2, 'member')",
        )
        .run();
    }
  });

  it("prevents column changes from racing with records validated against the old definition", async () => {
    const readValues = owner.repositories.nativeRecords.activeValues.bind(
      owner.repositories.nativeRecords,
    );
    const concurrentInsert = vi
      .spyOn(owner.repositories.nativeRecords, "activeValues")
      .mockImplementationOnce(async (...args) => {
        const validated = await readValues(...args);

        await createNativeRecord(member, table.output.id, {
          requestId: generateId(),
          tableRevision: 1,
          values: { name: "Concurrent", status: "Done" },
        });

        return validated;
      });

    try {
      await expect(
        updateNativeRecordTable(owner, table.output.id, {
          expectedRevision: 1,
          definition: {
            ...definition,
            columns: [
              ...definition.columns,
              { id: "approved", name: "Approved", type: "boolean", required: true },
            ],
          },
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    } finally {
      concurrentInsert.mockRestore();
    }

    expect((await getNativeRecordTable(owner, table.output.id)).definition.columns).toHaveLength(4);
    await expect(
      updateNativeRecordTable(owner, table.output.id, {
        expectedRevision: 1,
        definition: {
          ...definition,
          columns: definition.columns.filter((column) => column.id !== "name"),
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    const extended = await updateNativeRecordTable(owner, table.output.id, {
      expectedRevision: 1,
      definition: {
        ...definition,
        columns: [
          ...definition.columns,
          { id: "approved", name: "Approved", type: "boolean", required: false },
        ],
      },
    });

    expect(extended.output.revision).toBe(2);
    await expect(
      createNativeRecord(member, table.output.id, {
        requestId: generateId(),
        tableRevision: 1,
        values: { name: "Stale", status: "Done" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
