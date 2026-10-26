import { readSourceGeneration, type KnowledgeRelationKind } from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl, extractHttpUrls } from "@ngriffin_uk/polychat-utility-core";

import { knowledgeSourceId } from "~/modules/knowledge/application/intake/commit";
import { knowledgeArticleKey } from "~/modules/knowledge/domain/item";
import { KnowledgeLinkRepository } from "~/modules/knowledge/infrastructure/KnowledgeLinkRepository";

import type { KnowledgeEnricher } from "./types";

export const relateEnricher: KnowledgeEnricher = {
  name: "relate",
  label: "Related documents",
  version: 1,
  trigger: "commit",
  setting: "relate",
  appliesTo: (source) => source.kind !== "memory",
  run: async (context, { source, metadata, text, contentHash, scope }) => {
    const links = context.repositories.get(KnowledgeLinkRepository);
    const own = source.external_uri ? comparableHttpUrl(source.external_uri) : null;
    const citedIds = await Promise.all(
      extractHttpUrls(text).flatMap((url) => {
        const key = knowledgeArticleKey(url);

        return key && comparableHttpUrl(url) !== own ? [knowledgeSourceId(scope, key)] : [];
      }),
    );
    const derivedIds = readSourceGeneration(metadata)?.sourceIds ?? [];
    const [cited, derived, duplicates] = await Promise.all([
      links.existingInScope(scope, citedIds),
      links.existingInScope(scope, derivedIds),
      links.findByContentHash(scope, contentHash, source.id),
    ]);
    const relations = new Map<
      string,
      { relatedSourceId: string; relation: KnowledgeRelationKind }
    >();

    for (const [rows, relation] of [
      [cited, "cites"],
      [derived, "derived_from"],
      [duplicates, "duplicates"],
    ] as const) {
      for (const row of rows) {
        if (row.id !== source.id) {
          relations.set(`${relation}:${row.id}`, { relatedSourceId: row.id, relation });
        }
      }
    }

    await links.replaceRelations(source.id, [...relations.values()]);

    return { status: "done" };
  },
};
