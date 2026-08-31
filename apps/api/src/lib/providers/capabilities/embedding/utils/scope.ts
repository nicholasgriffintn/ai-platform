import type { RagOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const hasKeys = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && Object.keys(value).length > 0;
const PROVIDER_METADATA_KEYS = new Set(["chunkId", "chunkIndex", "documentId", "type"]);
const EMBEDDING_SCOPE_TAG_PATTERN = /^scope_v1_[a-f0-9]{32}$/;
const EMBEDDING_CREDENTIAL_FINGERPRINT_PREFIX = "credential_v1_";

type ProviderMetadataValue = string | number | boolean | string[];

const isProviderMetadataValue = (value: unknown): value is ProviderMetadataValue =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  (Array.isArray(value) && value.every((item) => typeof item === "string"));

export const getEmbeddingContentType = (options: RagOptions) =>
  options.contentType ?? options.embeddingType ?? options.type;

const bytesToHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

const getEmbeddingScopeTag = async (secret: string | undefined, scope: string) => {
  if (!secret || secret.length < 32) {
    throw new AssistantError(
      "A stable embedding scope secret of at least 32 characters is required",
      ErrorType.CONFIGURATION_ERROR,
      500,
    );
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(scope));

  return `scope_v1_${bytesToHex(signature).slice(0, 32)}`;
};

export const getPersonalEmbeddingScopeTag = (secret: string | undefined, userId: number) =>
  getEmbeddingScopeTag(secret, `personal:${userId}`);

export const getProjectEmbeddingScopeTag = (secret: string | undefined, projectId: string) =>
  getEmbeddingScopeTag(secret, `project:${projectId}`);

export const getEmbeddingCredentialFingerprint = async (
  secret: string | undefined,
  credential: string,
) => {
  const tag = await getEmbeddingScopeTag(secret, `credential:${credential}`);

  return `${EMBEDDING_CREDENTIAL_FINGERPRINT_PREFIX}${tag.slice("scope_v1_".length)}`;
};

export const requireEmbeddingScopeTag = (options: RagOptions): string => {
  if (!options.scopeTag || !EMBEDDING_SCOPE_TAG_PATTERN.test(options.scopeTag)) {
    throw new AssistantError(
      "Embedding operation requires an authorised scope",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return options.scopeTag;
};

export const withEmbeddingScopeMetadata = (
  metadata: Record<string, unknown>,
  options: RagOptions,
): Record<string, ProviderMetadataValue> => {
  const scopeTag = requireEmbeddingScopeTag(options);
  const internalMetadata: Record<string, ProviderMetadataValue> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (PROVIDER_METADATA_KEYS.has(key) && isProviderMetadataValue(value)) {
      internalMetadata[key] = value;
    }
  }

  return {
    ...internalMetadata,
    scopeTag,
  };
};

export const buildVectorizeMetadataFilter = (options: RagOptions) => {
  const scopeTag = requireEmbeddingScopeTag(options);
  const contentType = getEmbeddingContentType(options);
  const filter = {
    ...(hasKeys(options.filter) ? options.filter : {}),
    ...(contentType && { type: contentType }),
    scopeTag,
  };

  return hasKeys(filter) ? filter : undefined;
};

export const buildS3VectorsMetadataFilter = (options: RagOptions) => {
  const scopeTag = requireEmbeddingScopeTag(options);
  const filters: Record<string, unknown>[] = [];
  const contentType = getEmbeddingContentType(options);

  if (hasKeys(options.filter)) {
    filters.push(options.filter);
  }

  filters.push({ scopeTag: { $eq: scopeTag } });

  if (contentType) {
    filters.push({ type: { $eq: contentType } });
  }

  if (filters.length === 0) {
    return undefined;
  }

  return filters.length === 1 ? filters[0] : { $and: filters };
};

export const buildBedrockRetrievalFilter = (options: RagOptions) => {
  const scopeTag = requireEmbeddingScopeTag(options);
  const filters: Record<string, unknown>[] = [];
  const contentType = options.contentType ?? options.embeddingType;

  if (hasKeys(options.filter)) {
    filters.push(options.filter);
  }

  filters.push({ equals: { key: "scopeTag", value: scopeTag } });

  if (contentType) {
    filters.push({ equals: { key: "type", value: contentType } });
  }

  if (filters.length === 0) {
    return null;
  }

  return filters.length === 1 ? filters[0] : { andAll: filters };
};
