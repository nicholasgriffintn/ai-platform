const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETIRED_SHARE = 0.5;
const NON_CHAT_MODEL_ID = /embed|rerank|bge-|whisper|tts/i;

const lastPathSegment = (id) => id.split("/").at(-1);
const baseModelName = (id) => lastPathSegment(id.split("@")[0].split(":")[0]);

export const PROVIDER_MODEL_LISTS = {
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/models?output_modalities=all",
  },
  vercel: { label: "Vercel AI Gateway", url: "https://ai-gateway.vercel.sh/v1/models" },
  requesty: {
    label: "Requesty",
    url: "https://router.requesty.ai/v1/models",
    normalise: baseModelName,
  },
  kilo: {
    label: "Kilo",
    url: "https://api.kilo.ai/api/gateway/models",
    matchesBareIds: true,
  },
  opencode: { label: "OpenCode", url: "https://opencode.ai/zen/v1/models" },
  "ollama-cloud": { label: "Ollama Cloud", url: "https://ollama.com/api/tags" },
  chutes: { label: "Chutes", url: "https://llm.chutes.ai/v1/models" },
  cortecs: { label: "Cortecs", url: "https://api.cortecs.ai/v1/models" },
  deepinfra: { label: "DeepInfra", url: "https://api.deepinfra.com/models/list" },
  huggingface: {
    label: "Hugging Face",
    url: "https://router.huggingface.co/v1/models",
    chatOnly: true,
  },
  ovhcloud: {
    label: "OVHcloud",
    url: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models",
    chatOnly: true,
  },
  "regolo-ai": { label: "Regolo", url: "https://api.regolo.ai/v1/models", chatOnly: true },
};

function listedModelIds(payload) {
  const entries = Array.isArray(payload) ? payload : (payload?.data ?? payload?.models);

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("response has no models");
  }

  return entries
    .filter((entry) => !entry.deprecated)
    .map((entry) => entry.id ?? entry.model_name ?? entry.name)
    .filter((id) => typeof id === "string");
}

function buildAvailability(
  { label, normalise = (id) => id, chatOnly = false, matchesBareIds = false },
  modelIds,
) {
  const comparable = (id) => normalise(id).toLowerCase();
  const listed = new Set(modelIds.map(comparable));

  if (matchesBareIds) {
    modelIds.forEach((id) => listed.add(comparable(lastPathSegment(id))));
  }

  return {
    label,
    isOffered: (id) => (chatOnly && NON_CHAT_MODEL_ID.test(id)) || listed.has(comparable(id)),
  };
}

async function fetchProviderAvailability(list) {
  const response = await fetch(list.url, {
    headers: { accept: "application/json", "user-agent": "polychat-model-catalogue-sync" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }

  return buildAvailability(list, listedModelIds(await response.json()));
}

export async function fetchProviderModelLists(lists = PROVIDER_MODEL_LISTS) {
  const providers = Object.keys(lists);
  const results = await Promise.allSettled(
    providers.map((provider) => fetchProviderAvailability(lists[provider])),
  );

  return Object.fromEntries(
    results.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return [[providers[index], result.value]];
      }

      console.warn(`Skipped the ${providers[index]} model list: ${result.reason.message}`);

      return [];
    }),
  );
}

function retirementMessage(config, label) {
  return `${config.name ?? config.matchingModel} is no longer offered by ${label}.`;
}

function withoutRetirement(config) {
  const active = { ...config };

  delete active.deprecated;
  delete active.deprecationMessage;

  return active;
}

export function reconcileProviderAvailability({ provider, models, remoteModels, availability }) {
  const isUpstream = (modelKey, config) =>
    Boolean(remoteModels[modelKey] ?? remoteModels[config.matchingModel]);
  const isOffered = (modelKey, config) => availability.isOffered(config.matchingModel ?? modelKey);
  const entries = Object.entries(models);
  const active = entries.filter(([, config]) => !config.deprecated);
  const retiring = active.filter(
    ([modelKey, config]) => !isUpstream(modelKey, config) && !isOffered(modelKey, config),
  );
  const restoring = entries.filter(
    ([modelKey, config]) =>
      config.deprecated &&
      config.deprecationMessage === retirementMessage(config, availability.label) &&
      isOffered(modelKey, config),
  );

  if (retiring.length > active.length * MAX_RETIRED_SHARE) {
    console.warn(
      `Skipped retiring ${retiring.length} of ${active.length} active ${provider} models: the list looks incomplete`,
    );

    return { models, retired: 0, restored: 0 };
  }

  const next = { ...models };

  for (const [modelKey, config] of retiring) {
    next[modelKey] = {
      ...config,
      deprecated: true,
      deprecationMessage: retirementMessage(config, availability.label),
    };
  }

  for (const [modelKey, config] of restoring) {
    next[modelKey] = withoutRetirement(config);
  }

  return { models: next, retired: retiring.length, restored: restoring.length };
}
