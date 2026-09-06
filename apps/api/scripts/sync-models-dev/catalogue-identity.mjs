import { PROVIDER_ALIASES } from "./constants.mjs";

export function modelIdentity(provider, id, model, remoteProviders) {
  const remoteModels = remoteProviders[PROVIDER_ALIASES[provider] ?? provider]?.models ?? {};
  const remote = remoteModels[id] ?? remoteModels[model.matchingModel];
  const family =
    remote?.family || model.family || inferModelFamily(model.matchingModel || id, provider);
  const name = remote?.name || model.name || model.matchingModel || id;
  const key = `${family}/${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

  return { family, key, remote };
}

export function inferModelFamily(id, provider) {
  const name = id.toLowerCase();

  for (const family of [
    "claude-opus",
    "claude-sonnet",
    "claude-haiku",
    "claude",
    "gpt",
    "gemini",
    "gemma",
    "deepseek",
    "qwen",
    "llama",
    "mistral",
    "mixtral",
    "grok",
    "glm",
    "kimi",
    "minimax",
    "whisper",
    "flux",
    "stable-diffusion",
    "nova",
    "command",
    "jamba",
    "phi",
    "nemotron",
    "olmo",
    "seed",
    "solar",
    "vidu",
    "veo",
    "kling",
    "sora",
    "ideogram",
    "pixart",
  ]) {
    if (name.includes(family)) {
      return family;
    }
  }

  return `${provider}/${id}`;
}

export function describeModel(name, config) {
  const input = config.modalities?.input;
  const output = config.modalities?.output;

  if (input?.length && output?.length) {
    return `${name} accepts ${input.join(", ")} and produces ${output.join(", ")}.`;
  }

  if (config.strengths?.length) {
    return `${name} supports ${config.strengths.join(", ").replaceAll("_", " ")}.`;
  }

  return `${name} is available through the model catalogue.`;
}

export function describeFamily(family, models) {
  const descriptions = models.map((model) => model.description).filter(Boolean);
  const sharedDescription = descriptions.find(
    (description) =>
      descriptions.filter((candidate) => candidate === description).length >
      Math.max(1, models.length / 2),
  );

  if (sharedDescription) {
    return sharedDescription;
  }

  const outputs = [...new Set(models.flatMap((model) => model.modalities?.output ?? []))].toSorted(
    (a, b) => a.localeCompare(b),
  );
  const label = family.replaceAll("-", " ");

  return outputs.length
    ? `The ${label} family includes models that produce ${outputs.join(", ")}.`
    : `The ${label} family groups related models and their shared configuration.`;
}
