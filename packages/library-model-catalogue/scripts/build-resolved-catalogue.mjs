import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveModelCatalogueWithProviderIds } from "../src/schema.ts";
import { readCatalogue } from "./sync-models-dev/catalogue-files.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESOLVED_TYPES = `import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

export declare const modelConfig: ModelConfig;
export declare const providerModelIds: Record<string, Record<string, string>>;
`;

export function renderResolvedCatalogueModule(catalogue) {
  const { modelConfig, providerModelIds } = resolveModelCatalogueWithProviderIds(catalogue);

  return `export const modelConfig=${JSON.stringify(modelConfig)};\nexport const providerModelIds=${JSON.stringify(providerModelIds)};\n`;
}

export async function buildResolvedCatalogue({
  modelsDirectory = path.join(PACKAGE_ROOT, "src/data"),
  outputDirectory = path.join(PACKAGE_ROOT, "dist"),
} = {}) {
  const catalogue = await readCatalogue(modelsDirectory);

  await fs.mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(outputDirectory, "resolved.js"),
      renderResolvedCatalogueModule(catalogue),
    ),
    fs.writeFile(path.join(outputDirectory, "resolved.d.ts"), RESOLVED_TYPES),
  ]);
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (import.meta.url === invokedFile) {
  await buildResolvedCatalogue();
}
