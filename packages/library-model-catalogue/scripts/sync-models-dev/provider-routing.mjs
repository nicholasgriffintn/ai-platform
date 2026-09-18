const MANTLE_NPM_PACKAGE = "@ai-sdk/amazon-bedrock/mantle";
const MANTLE_API_HOST_FRAGMENT = "bedrock-mantle.";

const BEDROCK_PROVIDER = "bedrock";
const BEDROCK_MANTLE_PROVIDER = "bedrock-mantle";

export const ROUTED_PROVIDER_IDS = new Set([BEDROCK_MANTLE_PROVIDER]);

export function isBedrockMantleRemoteModel(remoteModel) {
  const providerOverride = remoteModel?.provider;

  if (
    !providerOverride ||
    typeof providerOverride !== "object" ||
    Array.isArray(providerOverride)
  ) {
    return false;
  }

  return (
    providerOverride.npm === MANTLE_NPM_PACKAGE ||
    (typeof providerOverride.api === "string" &&
      providerOverride.api.includes(MANTLE_API_HOST_FRAGMENT))
  );
}

const REMOTE_PROVIDER_ROUTES = {
  "amazon-bedrock": (remoteModel) =>
    isBedrockMantleRemoteModel(remoteModel) ? BEDROCK_MANTLE_PROVIDER : BEDROCK_PROVIDER,
};

export function resolveRemoteModelProvider(remoteProviderId, remoteModel) {
  const route = REMOTE_PROVIDER_ROUTES[remoteProviderId];

  return route ? route(remoteModel) : null;
}

export function remoteModelBelongsToProvider(remoteProviderId, provider, remoteModel) {
  const target = resolveRemoteModelProvider(remoteProviderId, remoteModel);

  return target === null || target === provider;
}
