import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { siteCollectionRecordSchema } from "@ngriffin_uk/polychat-schemas";
import { Miniflare, type ModuleDefinition } from "miniflare";
import { expect, it } from "vitest";
import z from "zod/v4";

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
    });
    expect((await runtime.dispatchFetch("http://localhost/activate")).ok).toBe(true);
    const created = await runtime.dispatchFetch("http://localhost/action", {
      method: "POST",
      body: JSON.stringify({
        action: "createRecord",
        collectionId: "tasks",
        values: { title: "Review" },
      }),
    });
    const [record] = z.array(siteCollectionRecordSchema).parse(await created.json());

    expect(record.values.title).toBe("Review");
    expect(
      z
        .array(siteCollectionRecordSchema)
        .parse(await (await runtime.dispatchFetch("http://localhost/read")).json()),
    ).toHaveLength(1);
    const remove = {
      action: "deleteRecord",
      collectionId: "tasks",
      recordId: record.id,
      expectedRecordRevision: 1,
    };

    expect(
      (
        await runtime.dispatchFetch("http://localhost/action?user=2", {
          method: "POST",
          body: JSON.stringify(remove),
        })
      ).status,
    ).toBe(409);
    const update = {
      action: "updateRecord",
      collectionId: "tasks",
      recordId: record.id,
      expectedRecordRevision: 1,
      values: { title: "Reviewed" },
    };

    expect(
      (
        await runtime.dispatchFetch("http://localhost/action?user=2&role=admin", {
          method: "POST",
          body: JSON.stringify(update),
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await runtime.dispatchFetch("http://localhost/action", {
          method: "POST",
          body: JSON.stringify(update),
        })
      ).status,
    ).toBe(409);
    await runtime.dispatchFetch("http://localhost/activate?site=second");
    expect(await (await runtime.dispatchFetch("http://localhost/read?site=second")).json()).toEqual(
      [],
    );
    await runtime.dispatchFetch("http://localhost/disable");
    expect((await runtime.dispatchFetch("http://localhost/read")).status).toBe(409);
    await runtime.dispatchFetch("http://localhost/activate?revision=2");
    expect(
      z
        .array(siteCollectionRecordSchema)
        .parse(await (await runtime.dispatchFetch("http://localhost/read?revision=2")).json())[0]
        .values.title,
    ).toBe("Reviewed");
    expect(
      (
        await runtime.dispatchFetch("http://localhost/action", {
          method: "POST",
          body: JSON.stringify(update),
        })
      ).status,
    ).toBe(409);
    const create = { action: "createRecord", collectionId: "tasks", values: { title: "Next" } };

    expect(
      (
        await runtime.dispatchFetch("http://localhost/action?revision=2", {
          method: "POST",
          body: JSON.stringify(create),
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await runtime.dispatchFetch("http://localhost/action?revision=2", {
          method: "POST",
          body: JSON.stringify(create),
        })
      ).status,
    ).toBe(409);
    await runtime.dispatchFetch("http://localhost/delete");
    await runtime.dispatchFetch("http://localhost/activate?revision=3");
    expect(await (await runtime.dispatchFetch("http://localhost/read?revision=3")).json()).toEqual(
      [],
    );
  } finally {
    await runtime?.dispose();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
