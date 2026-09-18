import catalogueData from "./data/index.js";
import { composioToolkitCatalogueSchema, type ConfiguredComposioToolkit } from "./schema.js";

const catalogue = composioToolkitCatalogueSchema.parse(catalogueData);

export const configuredComposioToolkits: Record<string, ConfiguredComposioToolkit> =
  catalogue.toolkits;

export function getConfiguredComposioToolkit(
  providerId: string,
): ConfiguredComposioToolkit | undefined {
  return configuredComposioToolkits[providerId];
}

export function listConfiguredComposioToolkits(): ConfiguredComposioToolkit[] {
  return Object.values(configuredComposioToolkits);
}
