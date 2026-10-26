import type { KnowledgeEnricherSettings } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { KnowledgeLinkScope } from "~/modules/knowledge/infrastructure/KnowledgeLinkRepository";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

export interface EnrichmentInput {
  source: SourceRecord;
  metadata: Record<string, unknown>;
  text: string;
  contentHash: string;
  scope: KnowledgeLinkScope;
}

export interface EnrichmentResult {
  status: "done" | "skipped";
  value?: unknown;
}

export interface KnowledgeEnricher {
  name: string;
  label: string;
  version: number;
  trigger: "commit" | "request";
  setting?: keyof KnowledgeEnricherSettings;
  metadataKey?: string;
  appliesTo: (source: SourceRecord) => boolean;
  readsFile?: boolean;
  variant?: (source: SourceRecord, metadata: Record<string, unknown>) => string | null;
  run: (context: ServiceContext, input: EnrichmentInput) => Promise<EnrichmentResult>;
}
