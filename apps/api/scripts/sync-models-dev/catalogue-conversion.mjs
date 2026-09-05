import { isDeepStrictEqual } from "node:util";

import {
  modelCatalogueSchema,
  resolveCatalogueProvider,
} from "../../src/lib/providers/models/catalogue-definition.mts";
import { describeFamily, describeModel, modelIdentity } from "./catalogue-identity.mjs";
import { differingValues, majorityValues } from "./value-utils.mjs";

const SHARED_FIELDS = new Set([
  "name",
  "description",
  "avatarUrl",
  "card",
  "openWeights",
  "knowledgeCutoffDate",
  "releaseDate",
  "modalities",
  "strengths",
  "contextComplexity",
  "reliability",
  "multimodal",
  "artificialAnalysis",
  "contextWindow",
  "maxTokens",
  "supportsAttachments",
  "supportsToolCalls",
  "supportsResponseFormat",
  "supportsTemperature",
  "supportsTopP",
  "reasoningConfig",
]);

export function convertCatalogue(providers, remoteProviders, previous) {
  const groups = new Map();
  const expectations = {};

  for (const [provider, offerings] of Object.entries(providers)) {
    expectations[provider] = {};
    for (const [id, original] of Object.entries(offerings)) {
      const identity = modelIdentity(provider, id, original, remoteProviders);
      const previousReference = previous?.providers[provider]?.models[id]?.model;

      if (previousReference && !identity.remote) {
        identity.key = previousReference;
        identity.family = previousReference.slice(0, previousReference.lastIndexOf("/"));
      }

      const {
        provider: _provider,
        matchingModel,
        family: _family,
        id: ignoredId,
        ...values
      } = original;

      if (ignoredId !== undefined) {
        throw new Error(`Unexpected stored public ID on ${provider}/${id}`);
      }

      const description = identity.remote?.description?.trim() || values.description?.trim();

      if (description) {
        values.description = description;
      }

      const group = groups.get(identity.key) ?? { family: identity.family, entries: [] };

      group.entries.push({ provider, id, matchingModel, values });
      groups.set(identity.key, group);
    }
  }

  const models = {};
  const families = {};

  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const descriptions = group.entries.map((entry) => entry.values.description).filter(Boolean);
    const fallback =
      descriptions[0] ??
      describeModel(group.entries[0].values.name || key.split("/").at(-1), group.entries[0].values);

    for (const entry of group.entries) {
      entry.values.description ||= fallback;
      expectations[entry.provider][entry.id] = {
        ...entry.values,
        family: group.family,
        provider: entry.provider,
        matchingModel: entry.matchingModel,
      };
    }

    const defaults = majorityValues(
      group.entries.map((entry) => entry.values),
      SHARED_FIELDS,
    );

    defaults.description = fallback;
    models[key] = { family: group.family, defaults };
  }

  for (const family of [...new Set(Object.values(models).map((model) => model.family))].toSorted(
    (a, b) => a.localeCompare(b),
  )) {
    const members = Object.values(models).filter((model) => model.family === family);
    const defaults = majorityValues(
      members.map((model) => model.defaults),
      new Set(
        [...SHARED_FIELDS].filter(
          (field) => !["name", "description", "card", "avatarUrl"].includes(field),
        ),
      ),
    );

    families[family] = {
      description:
        previous?.families[family]?.description ??
        describeFamily(
          family,
          members.map((model) => model.defaults),
        ),
      defaults,
    };
    for (const member of members) {
      member.defaults = differingValues(member.defaults, defaults);
    }
  }

  const providerDefinitions = {};

  for (const provider of Object.keys(providers)) {
    const entries = [...groups.entries()].flatMap(([key, group]) =>
      group.entries
        .filter((entry) => entry.provider === provider)
        .map((entry) => ({ ...entry, key })),
    );
    const providerFields = new Set(
      entries
        .flatMap((entry) => Object.keys(entry.values))
        .filter(
          (field) =>
            field.startsWith("supports") ||
            [
              "timeout",
              "apiOperation",
              "requiresResponsesApi",
              "bedrockApiOperation",
              "bedrockStreamingApiOperation",
              "inputFormat",
              "hiddenFromDefaultList",
            ].includes(field),
        ),
    );
    const defaults = majorityValues(
      entries.map((entry) => entry.values),
      providerFields,
    );
    const offerings = {};

    for (const id of Object.keys(providers[provider])) {
      const entry = entries.find((entry) => entry.id === id);
      const inherited = {
        ...families[models[entry.key].family].defaults,
        ...models[entry.key].defaults,
        ...defaults,
      };
      const unset = Object.keys(inherited).filter((key) => !Object.hasOwn(entry.values, key));

      offerings[id] = {
        model: entry.key,
        matchingModel: entry.matchingModel,
        overrides: differingValues(entry.values, inherited),
        ...(unset.length ? { unset } : {}),
      };
    }

    providerDefinitions[provider] = { defaults, models: offerings };
  }

  const validated = modelCatalogueSchema.parse({
    families: Object.fromEntries(
      Object.entries(families).map(([family, definition]) => [
        family,
        {
          ...definition,
          models: Object.fromEntries(
            Object.entries(models)
              .filter(([, model]) => model.family === family)
              .map(([key, model]) => [key.slice(family.length + 1), { defaults: model.defaults }]),
          ),
        },
      ]),
    ),
    providers: providerDefinitions,
  });

  for (const provider of Object.keys(providers)) {
    const resolved = resolveCatalogueProvider(validated, provider);

    for (const [id, expected] of Object.entries(expectations[provider])) {
      const actual = resolved[id];

      if (!expected.name) {
        expected.name = id;
      }

      if (!isDeepStrictEqual(actual, expected)) {
        throw new Error(`Conversion changed configuration for ${provider}/${id}`);
      }
    }
  }

  return validated;
}
