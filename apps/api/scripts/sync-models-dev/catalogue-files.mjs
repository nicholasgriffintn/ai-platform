import fs from "node:fs/promises";
import path from "node:path";

import { modelCatalogueSchema } from "../../src/lib/providers/models/catalogue-definition.mts";

export function catalogueFileSegment(value) {
  if (!value || value === "." || value === "..") {
    throw new Error(`Invalid catalogue path segment: ${value}`);
  }

  return encodeURIComponent(value);
}

export async function readCatalogue(directory) {
  const families = {};
  const providers = {};
  const familyFiles = await fs.readdir(path.join(directory, "families"), { withFileTypes: true });

  for (const entry of familyFiles.toSorted((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const family = decodeURIComponent(entry.name.slice(0, -5));

    families[family] = JSON.parse(
      await fs.readFile(path.join(directory, "families", entry.name), "utf8"),
    );
  }

  const order = JSON.parse(await fs.readFile(path.join(directory, "providers/index.json"), "utf8"));

  if (
    !Array.isArray(order) ||
    order.some((id) => typeof id !== "string") ||
    new Set(order).size !== order.length
  ) {
    throw new Error("Provider index must be an ordered list of unique provider IDs");
  }

  for (const provider of order) {
    providers[provider] = JSON.parse(
      await fs.readFile(
        path.join(directory, "providers", `${catalogueFileSegment(provider)}.json`),
        "utf8",
      ),
    );
  }

  return modelCatalogueSchema.parse({ families, providers });
}

export function catalogueFiles(catalogue) {
  const files = new Map();
  const imports = [];
  const familyEntries = [];
  const providerEntries = [];

  for (const [index, [family, definition]] of Object.entries(catalogue.families).entries()) {
    const file = `families/${catalogueFileSegment(family)}.json`;

    files.set(file, `${JSON.stringify(definition, null, 2)}\n`);
    imports.push(`import family${index} from "./${file}";`);
    familyEntries.push(`    ${JSON.stringify(family)}: family${index},`);
  }

  files.set(
    "providers/index.json",
    `${JSON.stringify(Object.keys(catalogue.providers), null, 2)}\n`,
  );
  for (const [index, [provider, definition]] of Object.entries(catalogue.providers).entries()) {
    const file = `providers/${catalogueFileSegment(provider)}.json`;

    files.set(file, `${JSON.stringify(definition, null, 2)}\n`);
    imports.push(`import provider${index} from "./${file}";`);
    providerEntries.push(`    ${JSON.stringify(provider)}: provider${index},`);
  }

  files.set(
    "index.ts",
    `${imports.join("\n")}\n\nexport default {\n  families: {\n${familyEntries.join("\n")}\n  },\n  providers: {\n${providerEntries.join("\n")}\n  },\n};\n`,
  );

  return files;
}

export async function listCatalogueFiles(directory, prefix = "") {
  let entries;

  try {
    entries = await fs.readdir(path.join(directory, prefix), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files = [];

  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);

    if (entry.isDirectory() && !prefix && ["families", "providers"].includes(entry.name)) {
      files.push(...(await listCatalogueFiles(directory, relative)));
    } else if (
      entry.isFile() &&
      ((prefix && entry.name.endsWith(".json")) || entry.name === "index.ts")
    ) {
      files.push(relative);
    }
  }

  return files;
}

export async function removeCatalogueFiles(directory, files) {
  for (const relative of files) {
    await fs.unlink(path.join(directory, relative));
  }
}
