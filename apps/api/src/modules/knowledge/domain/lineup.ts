export type KnowledgeTopicProvider = "feeds" | "news" | "web";

export interface KnowledgeTopicStep {
  provider: KnowledgeTopicProvider;
  runs: "until_full" | "when_empty";
  days?: number;
}

export const WIDER_NEWS_DAYS = 7;

export const KNOWLEDGE_TOPIC_LINEUPS: Record<"news" | "web", readonly KnowledgeTopicStep[]> = {
  news: [
    { provider: "feeds", runs: "until_full" },
    { provider: "news", runs: "until_full" },
    { provider: "news", runs: "when_empty", days: WIDER_NEWS_DAYS },
  ],
  web: [{ provider: "web", runs: "until_full" }],
};

export function shouldRunTopicStep(
  step: KnowledgeTopicStep,
  found: number,
  limit: number,
): boolean {
  return step.runs === "when_empty" ? found === 0 : found < limit;
}
