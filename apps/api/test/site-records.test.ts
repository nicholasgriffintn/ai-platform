import type { D1Database } from "@cloudflare/workers-types";
import {
  nativeRecordDefinitionSchema,
  nativeRecordViewSchema,
  type NativeRecordTable,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createNativeRecord,
  getNativeRecord,
  listNativeRecordChanges,
} from "~/modules/records/application/records";
import { createNativeRecordTable } from "~/modules/records/application/tables";
import { executeSiteRecordOperation } from "~/modules/sites/application/record-bindings";
import { createSite, deleteSite, getSite, updateSite } from "~/modules/sites/application/records";

import { databaseTestEnvironment } from "./helpers/environment";
import {
  initialiseProjectWorkDatabase,
  projectWorkTestContext,
} from "./helpers/project-work-database";
import { projectWorkSiteInput } from "./helpers/project-work-site";

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

describe("saved Site records and revision authority", () => {
  it("executes Site bindings as their viewer and fences a write against concurrent binding changes", async () => {
    const own = await createNativeRecord(member, table.output.id, {
      requestId: generateId(),
      tableRevision: 1,
      values: { name: "Member", status: "Backlog" },
    });
    const another = await createNativeRecord(owner, table.output.id, {
      requestId: generateId(),
      tableRevision: 1,
      values: { name: "Owner", status: "Done" },
    });
    const view = nativeRecordViewSchema.parse({
      id: "work",
      tableId: table.output.id,
      title: "Work",
      presentation: "table",
      query: { filters: [{ columnId: "status", operator: "eq", value: "Backlog" }] },
    });
    const input = projectWorkSiteInput();
    const scope = { context: owner, userId: 1, projectId: "project" };
    let site = await createSite(scope, {
      ...input,
      project: { ...input.project, recordViews: [view] },
    });
    const queried = await executeSiteRecordOperation(member, site.id, {
      operation: "query",
      viewId: "work",
      siteRevision: 1,
      offset: 0,
      limit: 100,
    });

    expect(queried).toMatchObject({
      operation: "query",
      table: { permissions: { actorUserId: 2, canEditAllRows: false } },
      result: { records: [{ id: own.id }] },
    });
    await expect(
      executeSiteRecordOperation(member, site.id, {
        operation: "update",
        viewId: "work",
        siteRevision: 1,
        recordId: own.id,
        input: {
          tableRevision: 1,
          expectedRevision: 1,
          values: { ...own.values, name: "Changed" },
        },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    site = await updateSite(
      scope,
      site.id,
      { ...input, project: { ...input.project, recordViews: [{ ...view, editable: true }] } },
      site.revision,
    );
    await expect(
      executeSiteRecordOperation(member, site.id, {
        operation: "update",
        viewId: "work",
        siteRevision: site.revision,
        recordId: another.id,
        input: {
          tableRevision: 1,
          expectedRevision: 1,
          values: { ...another.values, name: "Impersonated" },
        },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const write = member.repositories.nativeRecords.update.bind(member.repositories.nativeRecords);
    const removeEditPermission = vi
      .spyOn(member.repositories.nativeRecords, "update")
      .mockImplementationOnce(async (...args) => {
        await updateSite(
          scope,
          site.id,
          { ...input, project: { ...input.project, recordViews: [view] } },
          site.revision,
        );

        return write(...args);
      });

    try {
      await expect(
        executeSiteRecordOperation(member, site.id, {
          operation: "update",
          viewId: "work",
          siteRevision: site.revision,
          recordId: own.id,
          input: {
            tableRevision: 1,
            expectedRevision: 1,
            values: { ...own.values, name: "Raced" },
          },
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    } finally {
      removeEditPermission.mockRestore();
    }

    expect((await getNativeRecord(member, table.output.id, own.id)).values.name).toBe("Member");
    expect((await listNativeRecordChanges(member, table.output.id, 0)).changes).toHaveLength(2);
  });
  it("lets project members read a Site while reserving its changes for its author or administrators", async () => {
    const input = projectWorkSiteInput();
    const site = await createSite({ context: owner, userId: 1, projectId: "project" }, input);
    const memberScope = { context: member, userId: 2, projectId: "project" };

    expect((await getSite(memberScope, site.id)).id).toBe(site.id);
    await expect(getSite(memberScope, site.id, true)).rejects.toMatchObject({ statusCode: 403 });
    await expect(updateSite(memberScope, site.id, input, site.revision)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(deleteSite(memberScope, site.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      getSite({ context: outsider, userId: 3, projectId: "project" }, site.id),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(
      (
        await updateSite(
          { context: owner, userId: 1, projectId: "project" },
          site.id,
          input,
          site.revision,
        )
      ).revision,
    ).toBe(2);
  });
});
