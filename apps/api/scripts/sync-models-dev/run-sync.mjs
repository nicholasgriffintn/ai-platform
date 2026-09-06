import fs from "node:fs/promises";
import path from "node:path";

import { buildArtificialAnalysisLookup } from "./artificial-analysis.mjs";
import { convertCatalogue } from "./catalogue-conversion.mjs";
import {
  catalogueFiles,
  listCatalogueFiles,
  readCatalogue,
  removeCatalogueFiles,
} from "./catalogue-files.mjs";
import { syncCatalogue } from "./catalogue-sync.mjs";
import { readProviderSources } from "./convert-source.mjs";
import {
  fetchApiData,
  fetchArtificialAnalysisData,
  validateRemoteProviders,
} from "./remote-clients.mjs";

export async function runSyncModelsDev(options) {
  const remoteProviders = options.snapshot
    ? validateRemoteProviders(JSON.parse(await fs.readFile(options.snapshot, "utf8")))
    : await fetchApiData(options.apiUrl);
  let catalogue;
  let stats;

  if (options.convertFrom) {
    const providers = await readProviderSources(options.convertFrom);

    catalogue = convertCatalogue(providers, remoteProviders);
    stats = {
      convertedOfferings: Object.values(providers).reduce(
        (sum, models) => sum + Object.keys(models).length,
        0,
      ),
    };
  } else {
    const current = await readCatalogue(options.modelsDir);
    const analysis = options.snapshot
      ? []
      : await fetchArtificialAnalysisData({
          apiUrl: options.polychatApiBaseUrl,
          apiKey: options.polychatApiKey,
        });

    ({ catalogue, stats } = syncCatalogue(
      current,
      remoteProviders,
      buildArtificialAnalysisLookup(analysis),
      options.providers,
    ));
  }

  const outputs = [];
  const plannedFiles = catalogueFiles(catalogue);
  const removedFiles = (await listCatalogueFiles(options.modelsDir)).filter(
    (file) => !plannedFiles.has(file),
  );

  for (const [relative, content] of plannedFiles) {
    const filename = path.join(options.modelsDir, relative);
    let previous;

    try {
      previous = await fs.readFile(filename, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    if (content !== previous) {
      outputs.push({ filename, content });
    }
  }

  if (options.write) {
    if (options.saveSnapshot) {
      await fs.writeFile(options.saveSnapshot, `${JSON.stringify(remoteProviders, null, 2)}\n`);
    }

    await fs.mkdir(options.modelsDir, { recursive: true });
    for (const { filename, content } of outputs) {
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, content);
    }

    await removeCatalogueFiles(options.modelsDir, removedFiles);
  }

  if (options.verbose) {
    for (const { filename } of outputs) {
      console.log(`Write ${path.relative(options.modelsDir, filename)}`);
    }

    for (const relative of removedFiles) {
      console.log(`Remove ${relative}`);
    }
  }

  console.log(
    JSON.stringify({
      ...stats,
      families: Object.keys(catalogue.families).length,
      models: Object.values(catalogue.families).reduce(
        (sum, family) => sum + Object.keys(family.models).length,
        0,
      ),
      providers: Object.keys(catalogue.providers).length,
      changedFiles: outputs.length + removedFiles.length,
      written: options.write,
    }),
  );
  if (!options.write && (outputs.length || removedFiles.length)) {
    console.log("Dry run only. Re-run with --write to apply changes.");
  }

  return { ...stats, changedFiles: outputs.length + removedFiles.length };
}
