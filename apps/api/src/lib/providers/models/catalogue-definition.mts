import { modelConfigItemSchema } from "@ngriffin_uk/polychat-schemas";
import type { ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

export const modelDefaultsSchema = modelConfigItemSchema
  .omit({ id: true, provider: true, matchingModel: true, family: true })
  .partial()
  .strict();

const layerSchema = z
  .object({
    defaults: modelDefaultsSchema,
  })
  .strict();

export const modelCatalogueSchema = z
  .object({
    families: z.record(
      z.string(),
      layerSchema.extend({
        description: z.string().min(1),
        models: z.record(z.string(), layerSchema),
      }),
    ),
    providers: z.record(
      z.string(),
      layerSchema.extend({
        models: z.record(
          z.string(),
          z
            .object({
              model: z.string().min(1),
              matchingModel: z.string().min(1),
              overrides: modelDefaultsSchema,
              unset: z.array(modelDefaultsSchema.keyof()).optional(),
            })
            .strict(),
        ),
      }),
    ),
  })
  .strict();

export type ModelCatalogue = z.infer<typeof modelCatalogueSchema>;

export function resolveCatalogueProvider(
  catalogue: ModelCatalogue,
  providerId: string,
): ModelConfig {
  const provider = catalogue.providers[providerId];

  if (!provider) {
    throw new Error(`Unknown catalogue provider: ${providerId}`);
  }

  return Object.fromEntries(
    Object.entries(provider.models).map(([id, offering]) => {
      const separator = offering.model.lastIndexOf("/");
      const familyId = offering.model.slice(0, separator);
      const modelId = offering.model.slice(separator + 1);
      const family = catalogue.families[familyId];

      if (!family) {
        throw new Error(`Unknown family ${familyId} for ${offering.model}`);
      }

      const model = family.models[modelId];

      if (!model) {
        throw new Error(`Unknown model ${offering.model} for ${providerId}/${id}`);
      }

      const config: ModelConfigItem = {
        name: id,
        description: family.description,
        ...family.defaults,
        ...model.defaults,
        ...provider.defaults,
        ...offering.overrides,
        provider: providerId,
        matchingModel: offering.matchingModel,
        family: familyId,
      };

      for (const field of offering.unset ?? []) {
        delete config[field];
      }

      if (!config.description?.trim()) {
        throw new Error(`Missing description for ${providerId}/${id}`);
      }

      return [id, config];
    }),
  );
}

export function resolveModelCatalogue(catalogue: ModelCatalogue): ModelConfig {
  const models: ModelConfig = {};

  for (const provider of Object.keys(catalogue.providers)) {
    for (const [id, config] of Object.entries(resolveCatalogueProvider(catalogue, provider))) {
      let resolvedId = id;

      if (Object.hasOwn(models, resolvedId)) {
        resolvedId = `${provider}/${id}`;
        let suffix = 2;

        while (Object.hasOwn(models, resolvedId)) {
          resolvedId = `${provider}/${id}-${suffix++}`;
        }
      }

      models[resolvedId] = config;
    }
  }

  return models;
}
