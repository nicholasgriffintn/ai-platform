import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { siteCollectionRecordSchema, siteRuntimeStatusSchema } from "@ngriffin_uk/polychat-schemas";
import { Miniflare, type ModuleDefinition } from "miniflare";
import { expect, it } from "vitest";
import z from "zod/v4";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { editSite } from "~/modules/sites/application/edit";
import { deleteSite } from "~/modules/sites/application/records";
import {
  activateSiteRuntime,
  disableSiteRuntime,
  executeSiteDataAction,
  readSiteData,
} from "~/modules/sites/application/runtime";
import { requestSiteRuntime } from "~/modules/sites/infrastructure/runtime-client";
import type { IEnv } from "~/types";

import { browserTestUser } from "./fixtures/computer-use";
import { createSitesTestContext, resetSitesTestData, saveTestSite } from "./helpers/sites";

it("persists isolated records and enforces ownership, limits and revision fences", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "polychat-sites-runtime-"));
  let runtime: Miniflare | undefined;

  try {
    await promisify(execFile)(
      "pnpm",
      [
        "exec",
        "wrangler",
        "deploy",
        "--config",
        "test/fixtures/sites-runtime/wrangler.jsonc",
        "--dry-run",
        "--outdir",
        directory,
      ],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      },
    );
    const modules: ModuleDefinition[] = [
      {
        type: "ESModule",
        path: "worker.js",
        contents: await readFile(path.join(directory, "worker.js"), "utf8"),
      },
    ];

    for (const filename of await readdir(directory)) {
      if (filename.endsWith(".wasm")) {
        modules.push({
          type: "CompiledWasm",
          path: filename,
          contents: await readFile(path.join(directory, filename)),
        });
      }
    }

    runtime = new Miniflare({
      modules,
      compatibilityDate: "2026-08-01",
      durableObjects: { SITES_RUNTIME: { className: "SiteRuntime", useSQLite: true } },
      d1Databases: ["DB"],
      kvNamespaces: ["CACHE"],
    });
    const context = await createSitesTestContext(runtime);

    const bindings = await runtime.getBindings<Pick<IEnv, "SITES_RUNTIME">>();

    context.env.SITES_RUNTIME = bindings.SITES_RUNTIME;
    await resetSitesTestData(context);
    await saveTestSite(context, "project");
    const source = await context.repositories.sources.createSource({
      createdByUserId: 1,
      projectId: "project",
      kind: "text",
      title: "Rows",
      content: "[]",
    });
    const collections = {
      tasks: {
        label: "Tasks",
        maxRecords: 2,
        fields: { title: { type: "string" as const, required: true } },
      },
    };
    const site = await editSite({
      context,
      user: browserTestUser,
      siteId: "site",
      request: {
        projectId: "project",
        expectedRevision: 1,
        summary: "Add saved tasks",
        patches: [
          { op: "add", path: "/collections", value: collections },
          {
            op: "add",
            path: "/dataBindings",
            value: {
              rows: { kind: "source", sourceId: source.id, pageId: "home", statePath: "/rows" },
              tasks: {
                kind: "collection",
                collectionId: "tasks",
                pageId: "home",
                statePath: "/tasks",
              },
            },
          },
        ],
      },
    });
    const scope = { projectId: "project", expectedRevision: site.revision };

    await activateSiteRuntime(context, site.id, scope);
    await context.repositories.sources.updateSource(source.id, { content: "invalid JSON" });
    await expect(
      executeSiteDataAction(context, site.id, {
        ...scope,
        operation: {
          action: "createRecord",
          collectionId: "tasks",
          values: { title: "Must not persist" },
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await context.repositories.sources.updateSource(source.id, { content: "[]" });
    const created = await executeSiteDataAction(context, site.id, {
      ...scope,
      operation: { action: "createRecord", collectionId: "tasks", values: { title: "Review" } },
    });

    expect(created.bindings.tasks).toHaveLength(1);
    const [record] = z
      .array(z.object({ id: z.string(), revision: z.number(), title: z.string() }))
      .parse(created.bindings.tasks);

    expect(
      (
        await readSiteData(
          createServiceContext({ env: context.env, user: browserTestUser }),
          site.id,
          scope,
        )
      ).bindings.tasks,
    ).toEqual(created.bindings.tasks);
    const member = createServiceContext({ env: context.env, user: { ...browserTestUser, id: 2 } });

    await context.env.DB.prepare(
      "UPDATE workspace_member SET role = 'member' WHERE user_id = 2",
    ).run();
    const remove = {
      action: "deleteRecord" as const,
      collectionId: "tasks",
      recordId: record.id,
      expectedRecordRevision: record.revision,
    };

    await expect(
      executeSiteDataAction(member, site.id, { ...scope, operation: remove }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await context.env.DB.prepare(
      "UPDATE workspace_member SET role = 'admin' WHERE user_id = 2",
    ).run();
    const update = {
      action: "updateRecord" as const,
      collectionId: "tasks",
      recordId: record.id,
      expectedRecordRevision: record.revision,
      values: { title: "Reviewed" },
    };

    await executeSiteDataAction(member, site.id, { ...scope, operation: update });
    await expect(
      executeSiteDataAction(context, site.id, { ...scope, operation: update }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      executeSiteDataAction(context, site.id, {
        ...scope,
        operation: { action: "createRecord", collectionId: "tasks", values: { title: "" } },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(
      await requestSiteRuntime(
        context.env,
        "isolated",
        { operation: "activate", revision: 1, collections },
        siteRuntimeStatusSchema,
      ),
    ).toMatchObject({ enabled: true });
    expect(
      await requestSiteRuntime(
        context.env,
        "isolated",
        { operation: "read", revision: 1, collectionId: "tasks" },
        z.array(siteCollectionRecordSchema),
      ),
    ).toEqual([]);

    await disableSiteRuntime(context, site.id, scope);
    await expect(
      requestSiteRuntime(
        context.env,
        site.id,
        { operation: "activate", revision: 1, collections },
        siteRuntimeStatusSchema,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    const revised = await editSite({
      context,
      user: browserTestUser,
      siteId: site.id,
      request: {
        ...scope,
        summary: "Rename app",
        patches: [{ op: "replace", path: "/title", value: "Reviewed tasks" }],
      },
    });
    const latestScope = { ...scope, expectedRevision: revised.revision };

    await expect(
      requestSiteRuntime(
        context.env,
        site.id,
        {
          operation: "activate",
          revision: revised.revision,
          collections: {
            tasks: { ...collections.tasks, fields: { count: { type: "number", required: true } } },
          },
        },
        siteRuntimeStatusSchema,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    await activateSiteRuntime(context, site.id, latestScope);
    await expect(
      requestSiteRuntime(
        context.env,
        site.id,
        { operation: "disable", revision: site.revision },
        siteRuntimeStatusSchema,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await readSiteData(context, site.id, latestScope)).bindings.tasks).toMatchObject([
      { title: "Reviewed", revision: 2 },
    ]);
    const create = {
      action: "createRecord" as const,
      collectionId: "tasks",
      values: { title: "Next" },
    };

    await executeSiteDataAction(context, site.id, { ...latestScope, operation: create });
    await expect(
      executeSiteDataAction(context, site.id, { ...latestScope, operation: create }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await deleteSite({ context, userId: 1, projectId: "project" }, site.id);
    await expect(readSiteData(context, site.id, latestScope)).rejects.toMatchObject({
      statusCode: 404,
    });
    await requestSiteRuntime(
      context.env,
      site.id,
      { operation: "activate", revision: 1, collections },
      siteRuntimeStatusSchema,
    );
    expect(
      await requestSiteRuntime(
        context.env,
        site.id,
        { operation: "read", revision: 1, collectionId: "tasks" },
        z.array(siteCollectionRecordSchema),
      ),
    ).toEqual([]);
  } finally {
    await runtime?.dispose();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
