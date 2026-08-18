import assert from "node:assert/strict";
import { access } from "node:fs/promises";

const packageRoot = new URL("../", import.meta.url);
const manifest = (
  await import(new URL("package.json", packageRoot), {
    with: { type: "json" },
  })
).default;

assert.equal(manifest.files.includes("src"), false, "source files must not be published");

for (const target of Object.values(manifest.exports)) {
  for (const relativePath of Object.values(target)) {
    await access(new URL(relativePath, packageRoot));
  }
}

const publicInterface = await import(new URL(manifest.exports["."].import, packageRoot));

assert.equal(typeof publicInterface.messageSchema?.safeParse, "function");
