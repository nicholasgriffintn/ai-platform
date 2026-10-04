import { copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const bindings = fileURLToPath(import.meta.resolve("@cedar-policy/cedar-wasm/web"));

await copyFile(
  join(dirname(bindings), "cedar_wasm_bg.wasm"),
  new URL("../dist/cedar.wasm", import.meta.url),
);
