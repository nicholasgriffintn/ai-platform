import { classifyEnricher } from "./classify";
import { framingEnricher } from "./framing";
import { readingEnricher } from "./reading";
import { relateEnricher } from "./relate";
import { summaryEnricher } from "./summary";
import type { KnowledgeEnricher } from "./types";

export const KNOWLEDGE_ENRICHERS: readonly KnowledgeEnricher[] = [
  summaryEnricher,
  classifyEnricher,
  relateEnricher,
  framingEnricher,
  readingEnricher,
];

export function findKnowledgeEnricher(name: string): KnowledgeEnricher | undefined {
  return KNOWLEDGE_ENRICHERS.find((enricher) => enricher.name === name);
}
