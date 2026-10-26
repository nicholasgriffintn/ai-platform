import {
  KNOWLEDGE_BODY_METADATA_KEY,
  KNOWLEDGE_ENRICHMENTS_METADATA_KEY,
  KNOWLEDGE_EXPIRES_METADATA_KEY,
  KNOWLEDGE_ORIGIN_METADATA_KEY,
  KNOWLEDGE_RETRIEVAL_METADATA_KEY,
  KNOWLEDGE_UPSTREAM_METADATA_KEY,
  knowledgeBodySchema,
  knowledgeEnrichmentStateSchema,
  knowledgeOriginSchema,
  knowledgeUpstreamSchema,
  type KnowledgeBody,
  type KnowledgeEnrichmentState,
  type KnowledgeOrigin,
  type KnowledgeRetrieval,
  type KnowledgeUpstream,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";

type Metadata = Record<string, unknown> | null | undefined;

export function readKnowledgeOrigin(metadata: Metadata): KnowledgeOrigin | null {
  const parsed = knowledgeOriginSchema.safeParse(metadata?.[KNOWLEDGE_ORIGIN_METADATA_KEY]);

  return parsed.success ? parsed.data : null;
}

export function readKnowledgeUpstream(metadata: Metadata): KnowledgeUpstream | null {
  const parsed = knowledgeUpstreamSchema.safeParse(metadata?.[KNOWLEDGE_UPSTREAM_METADATA_KEY]);

  return parsed.success ? parsed.data : null;
}

export function readKnowledgeBody(metadata: Metadata): KnowledgeBody | null {
  const parsed = knowledgeBodySchema.safeParse(metadata?.[KNOWLEDGE_BODY_METADATA_KEY]);

  return parsed.success ? parsed.data : null;
}

export function readKnowledgeRetrieval(metadata: Metadata): KnowledgeRetrieval {
  return metadata?.[KNOWLEDGE_RETRIEVAL_METADATA_KEY] === "excluded" ? "excluded" : "included";
}

export function readKnowledgeExpiry(metadata: Metadata): string | null {
  return readNonEmptyString(metadata?.[KNOWLEDGE_EXPIRES_METADATA_KEY]) ?? null;
}

export function readKnowledgeEnrichments(
  metadata: Metadata,
): Record<string, KnowledgeEnrichmentState> {
  const raw = metadata?.[KNOWLEDGE_ENRICHMENTS_METADATA_KEY];

  if (!isRecord(raw)) {
    return {};
  }

  const states: Record<string, KnowledgeEnrichmentState> = {};

  for (const [name, value] of Object.entries(raw)) {
    const parsed = knowledgeEnrichmentStateSchema.safeParse(value);

    if (parsed.success) {
      states[name] = parsed.data;
    }
  }

  return states;
}

export function storedCharacters(content: string | null, metadata: Metadata): number {
  return readKnowledgeBody(metadata)?.characters ?? content?.length ?? 0;
}

const RESERVED_KNOWLEDGE_METADATA_KEYS = [
  KNOWLEDGE_BODY_METADATA_KEY,
  KNOWLEDGE_ENRICHMENTS_METADATA_KEY,
  KNOWLEDGE_ORIGIN_METADATA_KEY,
  KNOWLEDGE_UPSTREAM_METADATA_KEY,
  KNOWLEDGE_RETRIEVAL_METADATA_KEY,
  KNOWLEDGE_EXPIRES_METADATA_KEY,
  "syncId",
  "immutableSnapshot",
] as const;

export function withReservedKnowledgeMetadata(
  supplied: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...supplied };

  for (const key of RESERVED_KNOWLEDGE_METADATA_KEYS) {
    if (key in current) {
      next[key] = current[key];
    } else {
      delete next[key];
    }
  }

  return next;
}

export function knowledgeBodyBelongsTo(body: KnowledgeBody, sourceId: string): boolean {
  return body.key.startsWith(`knowledge/bodies/${sourceId}/`);
}
