import { resolveCatalogueProvider } from "../../src/lib/providers/models/catalogue-definition.mts";
import {
  buildArtificialAnalysisUpdateValues,
  findArtificialAnalysisModel,
} from "./artificial-analysis.mjs";
import { convertCatalogue } from "./catalogue-conversion.mjs";
import { modelIdentity } from "./catalogue-identity.mjs";
import { PROVIDER_ALIASES } from "./constants.mjs";
import { buildUpdateValues } from "./model-values.mjs";
import {
  buildProviderModelFamilies,
  buildProviderModelStatus,
  getCurrentAliasFamilies,
  hasDeprecatedStatus,
  isIgnoredRemoteModelId,
  isProtectedCurrentAliasEntry,
  isStaleUnmatchedFamilyEntry,
  remoteModelIsRepresentedByCurrentAlias,
  shouldProtectCurrentAlias,
} from "./remote-model-status.mjs";

export function syncCatalogue(catalogue, remoteProviders, analysisLookup, selectedProviders) {
  for (const selected of selectedProviders) {
    if (
      !Object.keys(catalogue.providers).some(
        (provider) => provider === selected || PROVIDER_ALIASES[provider] === selected,
      )
    ) {
      throw new Error(`Unknown selected provider: ${selected}`);
    }
  }

  const providers = {};
  const stats = { updatedModels: 0, addedModels: 0, removedModels: 0 };

  for (const provider of Object.keys(catalogue.providers)) {
    const current = resolveCatalogueProvider(catalogue, provider);
    const remoteProviderId = PROVIDER_ALIASES[provider] ?? provider;

    if (
      selectedProviders.size &&
      !selectedProviders.has(provider) &&
      !selectedProviders.has(remoteProviderId)
    ) {
      providers[provider] = current;
      continue;
    }

    const remoteProvider = remoteProviders[remoteProviderId];
    const remoteModels = remoteProvider?.models ?? {};
    const status = buildProviderModelStatus(remoteModels, remoteProviderId);
    const families = buildProviderModelFamilies(remoteModels, remoteProviderId);
    const entries = Object.entries(current).map(([modelKey, config]) => ({ modelKey, config }));
    const aliases = getCurrentAliasFamilies(entries, remoteProviderId);
    const represented = new Set(
      entries.flatMap(({ modelKey, config }) => [
        modelKey,
        config.matchingModel,
        ...Object.values(config.reasoningConfig?.modelOverrides ?? {}),
      ]),
    );
    const next = {};

    for (const entry of entries) {
      const { modelKey, config } = entry;
      const remote = remoteModels[modelKey] ?? remoteModels[config.matchingModel];
      const remoteId = remote?.id ?? config.matchingModel;

      if (
        hasDeprecatedStatus(remoteProvider) ||
        hasDeprecatedStatus(remote) ||
        status.outdatedModelIds.has(remoteId) ||
        (status.latestModelIds.size > 0 &&
          !status.latestModelIds.has(remoteId) &&
          !isProtectedCurrentAliasEntry(entry, remoteProviderId)) ||
        isStaleUnmatchedFamilyEntry({
          remoteModel: remote,
          remoteModelId: remoteId,
          remoteModelFamilies: families,
          provider: remoteProviderId,
          currentAliasFamilies: aliases,
        })
      ) {
        stats.removedModels++;
        continue;
      }

      const values = remote
        ? buildUpdateValues(remote, {
            modelKey: remoteId,
            existingMatchingModel: config.matchingModel,
            allowMatchingModelUpdate:
              config.matchingModel === modelKey || config.matchingModel === remoteId,
            isNewEntry: false,
            includeProvider: false,
            provider,
            existingReasoningConfig: config.reasoningConfig,
          })
        : {};
      const analysis = findArtificialAnalysisModel({
        lookup: analysisLookup,
        entry,
        remoteModel: remote,
        remoteModelId: remoteId,
      });

      next[modelKey] = {
        ...config,
        ...values,
        ...buildArtificialAnalysisUpdateValues(analysis, { ...config, ...values }),
      };
      if (remote || analysis) {
        stats.updatedModels++;
      }
    }

    for (const [id, remote] of Object.entries(remoteModels).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (
        hasDeprecatedStatus(remoteProvider) ||
        represented.has(id) ||
        isIgnoredRemoteModelId(remoteProviderId, id) ||
        hasDeprecatedStatus(remote) ||
        status.outdatedModelIds.has(id) ||
        (status.latestModelIds.size > 0 && !status.latestModelIds.has(id)) ||
        (remoteModelIsRepresentedByCurrentAlias(id, aliases) &&
          !shouldProtectCurrentAlias(remoteProviderId, id))
      ) {
        continue;
      }

      const identity = modelIdentity(provider, id, { matchingModel: id }, remoteProviders);
      const shared =
        catalogue.families[identity.family]?.models[identity.key.slice(identity.family.length + 1)];
      const values = {
        ...catalogue.families[identity.family]?.defaults,
        ...shared?.defaults,
        ...catalogue.providers[provider].defaults,
        ...buildUpdateValues(remote, {
          modelKey: id,
          allowMatchingModelUpdate: true,
          isNewEntry: true,
          includeProvider: true,
          provider,
        }),
      };
      const analysis = findArtificialAnalysisModel({
        lookup: analysisLookup,
        entry: { modelKey: id, config: values },
        remoteModel: remote,
        remoteModelId: id,
      });

      next[id] = { ...values, ...buildArtificialAnalysisUpdateValues(analysis, values) };
      stats.addedModels++;
    }

    providers[provider] = next;
  }

  const selectedRemoteProviders = Object.fromEntries(
    Object.entries(remoteProviders).filter(
      ([id]) =>
        !selectedProviders.size ||
        selectedProviders.has(id) ||
        Object.entries(PROVIDER_ALIASES).some(
          ([local, remote]) => remote === id && selectedProviders.has(local),
        ),
    ),
  );

  return { catalogue: convertCatalogue(providers, selectedRemoteProviders, catalogue), stats };
}
