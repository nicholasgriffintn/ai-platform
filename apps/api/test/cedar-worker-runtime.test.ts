import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { Miniflare, type ModuleDefinition } from "miniflare";
import { expect, it } from "vitest";

it("evaluates the official Cedar engine inside the Worker runtime", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "polychat-cedar-worker-"));
  let runtime: Miniflare | undefined;

  try {
    await promisify(execFile)(
      "pnpm",
      [
        "exec",
        "wrangler",
        "deploy",
        "--config",
        "test/fixtures/cedar/wrangler.jsonc",
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
    });
    const response = await runtime.dispatchFetch("http://localhost/");

    expect(await response.json()).toEqual({
      allow: true,
      deny: false,
      excluded: false,
      service: true,
    });
  } finally {
    await runtime?.dispose();
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
