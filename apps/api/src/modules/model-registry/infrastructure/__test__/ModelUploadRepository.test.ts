import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ModelUploadRepository } from "../ModelUploadRepository";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let repository: ModelUploadRepository;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");

  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE workspace (id TEXT PRIMARY KEY)"),
    database.prepare("INSERT INTO user VALUES (1)"),
    database.prepare("INSERT INTO workspace VALUES ('workspace')"),
  ]);
  const migration = await readFile(
    new URL("../../../../../migrations/0054_model_platform.sql", import.meta.url),
    "utf8",
  );

  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.includes("CREATE TABLE `model_upload`")) {
      await database.prepare(statement).run();
    }
  }

  repository = new ModelUploadRepository({ DB: database });
});
afterAll(() => runtime.dispose());

describe("multipart progress", () => {
  it("retains every concurrent part and replaces retried ETags without duplicate progress", async () => {
    const upload = await repository.create({
      workspaceId: "workspace",
      purpose: "model",
      name: "test",
      partBytes: 10,
      createdBy: 1,
      files: [
        {
          index: 0,
          path: "model.safetensors",
          size: 30,
          partCount: 3,
          partsUploaded: [],
          sha256: null,
          key: "key",
          multipartId: "multipart",
          etags: {},
        },
      ],
    });
    const base = { workspaceId: "workspace", uploadId: upload.id, fileIndex: 0 };
    const recorded = await Promise.all(
      [1, 2, 3].map((partNumber) =>
        repository.recordPart({ ...base, partNumber, etag: `etag-${partNumber}` }),
      ),
    );

    expect(recorded).toEqual([true, true, true]);
    await repository.recordPart({ ...base, partNumber: 2, etag: "replacement" });
    const stored = await repository.get("workspace", upload.id);

    expect(new Set(stored?.files[0].partsUploaded)).toEqual(new Set([1, 2, 3]));
    expect(stored?.files[0].etags).toEqual({ "1": "etag-1", "2": "replacement", "3": "etag-3" });
    expect(
      await repository.recordPart({
        ...base,
        workspaceId: "foreign",
        partNumber: 1,
        etag: "foreign",
      }),
    ).toBe(false);
    expect(await repository.recordPart({ ...base, partNumber: 4, etag: "extra" })).toBe(false);
    await repository.update(upload.id, { status: "aborted" });
    expect(await repository.recordPart({ ...base, partNumber: 1, etag: "late" })).toBe(false);
    expect((await repository.get("workspace", upload.id))?.files[0].etags["1"]).toBe("etag-1");
  });
});
