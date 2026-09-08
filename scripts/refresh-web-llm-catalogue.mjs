import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(new URL("../packages/library-react/package.json", import.meta.url));
const { prebuiltAppConfig } = await import(pathToFileURL(require.resolve("@mlc-ai/web-llm")).href);
const packageInfo = JSON.parse(
  await readFile(require.resolve("@mlc-ai/web-llm/package.json"), "utf8"),
);
const catalogue = {
  version: packageInfo.version,
  models: prebuiltAppConfig.model_list
    .filter((model) => model.model_id.includes("q0f16") || model.model_id.includes("q4f16"))
    .map((model) => ({ id: model.model_id, url: model.model })),
};
const output = `${JSON.stringify(catalogue, null, 2)}\n`;
const target = new URL("../packages/library-react/src/lib/web-llm-catalogue.json", import.meta.url);

if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== output) {
    throw new Error("Browser catalogue is stale. Run node scripts/refresh-web-llm-catalogue.mjs.");
  }
} else {
  await writeFile(target, output);
}
