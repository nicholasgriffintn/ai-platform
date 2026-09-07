import { readFile, writeFile } from "node:fs/promises";

const path = "/container-server/dist/index.js";
const source = await readFile(path, "utf8");
const original =
  'process.on("uncaughtException",($)=>{v.error("Uncaught exception",$),process.exit(1)});';
const replacement =
  'process.on("uncaughtException",($)=>{if(typeof $.message==="string"&&/^ENOENT: no such file or directory, (?:open|watch) \'\\/tmp\\/session-sandbox-[^\']+\\/[^\']+\\.pid\'$/.test($.message))return;v.error("Uncaught exception",$),process.exit(1)});';

if (source.split(original).length !== 2) {
  throw new Error("Expected one Sandbox container uncaught-exception handler");
}

await writeFile(path, source.replace(original, replacement));
