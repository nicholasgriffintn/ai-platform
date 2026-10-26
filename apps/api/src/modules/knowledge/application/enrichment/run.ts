import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { KnowledgeEnrichmentState } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { publishKnowledgeChange } from "~/modules/knowledge/application/events";
import { readKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { readKnowledgeEnrichments } from "~/modules/knowledge/domain/envelope";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import { requireSourceAccess } from "~/modules/sources/application/sources";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { findKnowledgeEnricher, KNOWLEDGE_ENRICHERS } from "./registry";
import { readKnowledgeEnricherSettings } from "./settings";
import type { KnowledgeEnricher } from "./types";

const logger = getLogger({ prefix: "knowledge/enrichment" });
const ERROR_CHARACTERS = 500;

function linkScope(source: SourceRecord) {
  return { userId: source.created_by_user_id, projectId: source.project_id };
}

async function materialHash(
  enricher: KnowledgeEnricher,
  source: SourceRecord,
  text: string,
): Promise<string> {
  const variant = enricher.variant?.(source, parseJsonRecord(source.metadata)) ?? null;

  return sha256Hex(variant === null ? text : `${variant}\n${text}`);
}

function isCurrent(
  state: KnowledgeEnrichmentState | undefined,
  enricher: KnowledgeEnricher,
  contentHash: string,
): boolean {
  return (
    state !== undefined &&
    state.status !== "failed" &&
    state.version === enricher.version &&
    state.contentHash === contentHash
  );
}

async function applyEnricher(
  context: ServiceContext,
  enricher: KnowledgeEnricher,
  source: SourceRecord,
  text: string,
  contentHash: string,
): Promise<void> {
  const documents = context.repositories.get(KnowledgeDocumentRepository);
  const at = new Date().toISOString();
  const result = await enricher.run(context, {
    source,
    metadata: parseJsonRecord(source.metadata),
    text,
    contentHash,
    scope: linkScope(source),
  });

  await documents.setEnrichment(
    source.id,
    enricher.name,
    { version: enricher.version, status: result.status, contentHash, at },
    enricher.metadataKey && result.value !== undefined
      ? { key: enricher.metadataKey, value: result.value }
      : undefined,
  );
}

async function recordFailure(
  context: ServiceContext,
  enricher: KnowledgeEnricher,
  sourceId: string,
  contentHash: string,
  error: unknown,
): Promise<void> {
  const message = getErrorMessage(error).slice(0, ERROR_CHARACTERS);

  logger.warn("A knowledge enricher failed", {
    source_id: sourceId,
    enricher: enricher.name,
    error_message: message,
  });
  await context.repositories
    .get(KnowledgeDocumentRepository)
    .setEnrichment(sourceId, enricher.name, {
      version: enricher.version,
      status: "failed",
      contentHash,
      at: new Date().toISOString(),
      error: message,
    });
}

export async function runCommitEnrichers(
  context: ServiceContext,
  source: SourceRecord,
  text: string,
): Promise<void> {
  const settings = await readKnowledgeEnricherSettings(context, linkScope(source));
  const sources = context.repositories.get(SourceRepository);
  let enriched = false;

  for (const enricher of KNOWLEDGE_ENRICHERS) {
    if (
      enricher.trigger !== "commit" ||
      (enricher.setting && !settings[enricher.setting]) ||
      !enricher.appliesTo(source)
    ) {
      continue;
    }

    const current = await sources.getSource(source.id);

    if (!current) {
      return;
    }

    const metadata = parseJsonRecord(current.metadata);
    const contentHash = await materialHash(enricher, current, text);

    if (
      metadata.immutableSnapshot === true ||
      isCurrent(readKnowledgeEnrichments(metadata)[enricher.name], enricher, contentHash)
    ) {
      continue;
    }

    try {
      await applyEnricher(context, enricher, current, text, contentHash);
      enriched = true;
    } catch (error) {
      await recordFailure(context, enricher, current.id, contentHash, error);
    }
  }

  if (enriched) {
    await publishKnowledgeChange(context, source, "enriched");
  }
}

export async function runKnowledgeEnricher(
  context: ServiceContext,
  sourceId: string,
  name: string,
): Promise<SourceRecord> {
  const enricher = findKnowledgeEnricher(name);
  const source = await requireSourceAccess(context, context.requireUser().id, sourceId);

  if (!enricher?.appliesTo(source)) {
    throw new AssistantError(
      "This document can't be enriched that way",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const text = await readKnowledgeText(context, source);

  if (!text.trim() && !(enricher.readsFile && source.storage_key)) {
    throw new AssistantError(
      "There is no text in this document to work from",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const contentHash = await materialHash(enricher, source, text);

  if (
    !isCurrent(
      readKnowledgeEnrichments(parseJsonRecord(source.metadata))[name],
      enricher,
      contentHash,
    )
  ) {
    try {
      await applyEnricher(context, enricher, source, text, contentHash);
    } catch (error) {
      await recordFailure(context, enricher, source.id, contentHash, error);
      throw error;
    }

    await publishKnowledgeChange(context, source, "enriched", { enricher: name });
  }

  const updated = await context.repositories.get(SourceRepository).getSource(source.id);

  if (!updated) {
    throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
  }

  return updated;
}
