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
  remoteModelBelongsToProvider,
  resolveRemoteModelProvider,
  ROUTED_PROVIDER_IDS,
} from "./provider-routing.mjs";
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

function buildSelection(selectedProviders) {
  return new Set([...selectedProviders].map((selected) => PROVIDER_ALIASES[selected] ?? selected));
}

function isProviderSelected(provider, selection) {
  if (!selection.size) {
    return true;
  }

  return selection.has(PROVIDER_ALIASES[provider] ?? provider);
}

function planProviders(catalogue, remoteProviders, selection) {
  const order = [];
  const planned = new Set();

  for (const provider of Object.keys(catalogue.providers)) {
    if (!planned.has(provider)) {
      planned.add(provider);
      order.push(provider);
    }

    const remoteProviderId = PROVIDER_ALIASES[provider] ?? provider;

    for (const remoteModel of Object.values(remoteProviders[remoteProviderId]?.models ?? {})) {
      const target = resolveRemoteModelProvider(remoteProviderId, remoteModel);

      if (target && !planned.has(target) && isProviderSelected(target, selection)) {
        planned.add(target);
        order.push(target);
      }
    }
  }

  return order;
}

function collectProviderTransfers(catalogue, remoteProviders, providerOrder, selection) {
  const transferredEntries = new Map();
  const transferredKeys = new Map();

  for (const provider of providerOrder) {
    if (!catalogue.providers[provider] || !isProviderSelected(provider, selection)) {
      continue;
    }

    const remoteProviderId = PROVIDER_ALIASES[provider] ?? provider;
    const upstreamModels = remoteProviders[remoteProviderId]?.models ?? {};
    const current = resolveCatalogueProvider(catalogue, provider);

    for (const [modelKey, config] of Object.entries(current)) {
      const upstreamModel = upstreamModels[modelKey] ?? upstreamModels[config.matchingModel];

      if (!upstreamModel) {
        continue;
      }

      const target = resolveRemoteModelProvider(remoteProviderId, upstreamModel);

      if (!target || target === provider || !providerOrder.includes(target)) {
        continue;
      }

      transferredKeys.set(provider, (transferredKeys.get(provider) ?? new Set()).add(modelKey));
      transferredEntries.set(target, [
        ...(transferredEntries.get(target) ?? []),
        { modelKey, config },
      ]);
    }
  }

  return { transferredEntries, transferredKeys };
}

export function syncCatalogue(catalogue, remoteProviders, analysisLookup, selectedProviders) {
  for (const selected of selectedProviders) {
    if (
      !Object.keys(catalogue.providers).some(
        (provider) => provider === selected || PROVIDER_ALIASES[provider] === selected,
      ) &&
      !ROUTED_PROVIDER_IDS.has(selected)
    ) {
      throw new Error(`Unknown selected provider: ${selected}`);
    }
  }

  const providers = {};
  const stats = { updatedModels: 0, addedModels: 0, removedModels: 0 };
  const selection = buildSelection(selectedProviders);
  const providerOrder = planProviders(catalogue, remoteProviders, selection);
  const { transferredEntries, transferredKeys } = collectProviderTransfers(
    catalogue,
    remoteProviders,
    providerOrder,
    selection,
  );

  for (const provider of providerOrder) {
    const current = catalogue.providers[provider]
      ? resolveCatalogueProvider(catalogue, provider)
      : {};
    const remoteProviderId = PROVIDER_ALIASES[provider] ?? provider;

    if (!isProviderSelected(provider, selection)) {
      providers[provider] = current;
      continue;
    }

    const remoteProvider = remoteProviders[remoteProviderId];
    const upstreamModels = remoteProvider?.models ?? {};
    const remoteModels = Object.fromEntries(
      Object.entries(upstreamModels).filter(([, model]) =>
        remoteModelBelongsToProvider(remoteProviderId, provider, model),
      ),
    );
    const status = buildProviderModelStatus(remoteModels, remoteProviderId);
    const families = buildProviderModelFamilies(remoteModels, remoteProviderId);
    const transferredAway = transferredKeys.get(provider) ?? new Set();
    const entries = [
      ...Object.entries(current)
        .filter(([modelKey]) => !transferredAway.has(modelKey))
        .map(([modelKey, config]) => ({ modelKey, config })),
      ...(transferredEntries.get(provider) ?? []),
    ];
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
        ...catalogue.providers[provider]?.defaults,
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
