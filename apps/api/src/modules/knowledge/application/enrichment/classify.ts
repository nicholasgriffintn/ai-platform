import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import {
  KNOWLEDGE_CLASSIFICATION_METADATA_KEY,
  knowledgeClassificationSchema,
  type KnowledgeClassification,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex, truncateForModel } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { knowledgeScopeKey } from "~/modules/knowledge/domain/item";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import {
  KnowledgeLinkRepository,
  type ClassificationCollection,
  type KnowledgeLinkScope,
} from "~/modules/knowledge/infrastructure/KnowledgeLinkRepository";
import { generateSystemObject } from "~/modules/models/application/system-object";
import { readSourceSummary, renderSourceSummary } from "~/modules/sources/domain/summary";

import type { KnowledgeEnricher } from "./types";

const CLASSIFY_MATERIAL_CHARACTERS = 16_000;

async function classificationCollectionId(
  scope: KnowledgeLinkScope,
  kind: ClassificationCollection["kind"],
  name: string,
): Promise<string> {
  const digest = await sha256Hex(`${knowledgeScopeKey(scope)}:${kind}:${name.toLowerCase()}`);

  return `${kind}_${digest.slice(0, 32)}`;
}

async function fileClassification(
  context: ServiceContext,
  sourceId: string,
  scope: KnowledgeLinkScope,
  classification: KnowledgeClassification,
): Promise<void> {
  const collections: ClassificationCollection[] = await Promise.all([
    ...classification.topics.map(async (topic) => ({
      id: await classificationCollectionId(scope, "topic", topic),
      kind: "topic" as const,
      title: topic,
      description: null,
    })),
    ...classification.entities.map(async (entity) => ({
      id: await classificationCollectionId(scope, "entity", `${entity.type}:${entity.name}`),
      kind: "entity" as const,
      title: entity.name,
      description: entity.type,
    })),
  ]);
  const links = context.repositories.get(KnowledgeLinkRepository);

  await links.ensureClassificationCollections(scope, collections);
  await links.replaceClassificationLinks(
    sourceId,
    collections.map((collection) => collection.id),
  );
}

export const classifyEnricher: KnowledgeEnricher = {
  name: "classify",
  label: "Topics",
  version: 2,
  trigger: "commit",
  setting: "classify",
  metadataKey: KNOWLEDGE_CLASSIFICATION_METADATA_KEY,
  appliesTo: (source) => source.kind !== "memory" && source.kind !== "podcast",
  run: async (context, { source, metadata, text, scope }) => {
    const summary = readSourceSummary(metadata);
    const existing = await context.repositories
      .get(KnowledgeLinkRepository)
      .listClassificationTitles(scope, "topic");
    const classification = await generateSystemObject(context, {
      role: "housekeeping",
      name: "knowledge_classify",
      schema: knowledgeClassificationSchema,
      system: getPromptText("knowledge/classify"),
      material: [
        `Title: ${source.title}`,
        summary
          ? `Summary:\n${renderSourceSummary(summary)}`
          : `Text:\n${truncateForModel(text, CLASSIFY_MATERIAL_CHARACTERS)}`,
        existing.length > 0
          ? `Existing topics: ${existing.map((topic) => topic.title).join(", ")}`
          : "Existing topics: none yet",
      ].join("\n\n"),
    });

    await fileClassification(context, source.id, scope, classification);

    const documents = context.repositories.get(KnowledgeDocumentRepository);

    if ((await documents.getSensitivity(source.id))?.sensitivity === null) {
      await documents.setControls(source.id, { sensitivity: classification.sensitivity });
    }

    return { status: "done", value: classification };
  },
};
