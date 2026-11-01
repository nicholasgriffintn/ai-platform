import { epochSecondsToIso } from "@ngriffin_uk/polychat-utility-core";
import { htmlToPlainText } from "@ngriffin_uk/polychat-utility-server/html-text";

import type { DiscoverResearchResult } from "../research";
import { count, describeEngagement, first, joinParts, lines, records } from "./read";
import type { DiscoverSignal } from "./types";

const STACK_EXCHANGE_SITE = "stackoverflow";
const STACK_EXCHANGE_TAG_LIMIT = 3;
const STACK_EXCHANGE_QUESTIONS_PER_TAG = 5;
const STACK_EXCHANGE_MIN_SCORE = 5;

function stackExchangeTags(result: unknown): string[] {
  return records(result, ["data", "items"], ["items"])
    .map((tag) => first(tag, ["tag_name"]))
    .filter(Boolean)
    .slice(0, STACK_EXCHANGE_TAG_LIMIT);
}

function stackExchangeQuestions(results: unknown): Record<string, unknown>[] {
  return (Array.isArray(results) ? results : []).flatMap((result) =>
    records(result, ["data", "items"], ["items"]),
  );
}

function stackExchangeItems(results: unknown): DiscoverResearchResult[] {
  return stackExchangeQuestions(results)
    .flatMap((question) => {
      const title = htmlToPlainText(first(question, ["title"]));
      const url = first(question, ["link"]);
      const score = count(question, ["score"]);

      return title && url && score >= STACK_EXCHANGE_MIN_SCORE
        ? [
            {
              score,
              item: {
                title,
                url,
                snippet: joinParts(
                  first(question, ["tags"]),
                  `${count(question, ["answer_count"])} answers`,
                ),
                source: describeEngagement("Stack Overflow", score, "votes"),
                date: epochSecondsToIso(question.creation_date)?.slice(0, 10) ?? "",
              },
            },
          ]
        : [];
    })
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
}

export const STACK_EXCHANGE_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "stackexchange-top-tags",
    providerId: "stack_exchange",
    group: "work",
    title: "Stack Overflow",
    description: "Reads this week's best questions in the tags you know best.",
    operation: "STACK_EXCHANGE_GET_MY_TOP_TAGS",
    parameters: () => ({ site: STACK_EXCHANGE_SITE, pagesize: STACK_EXCHANGE_TAG_LIMIT }),
    expand: {
      operation: "STACK_EXCHANGE_GET_QUESTIONS",
      requests: (result) =>
        stackExchangeTags(result).map((tag) => ({
          site: STACK_EXCHANGE_SITE,
          tagged: tag,
          sort: "week",
          order: "desc",
          pagesize: STACK_EXCHANGE_QUESTIONS_PER_TAG,
        })),
    },
    items: (results) => stackExchangeItems(results),
    digest: (results) =>
      lines(stackExchangeQuestions(results), (question) =>
        joinParts(htmlToPlainText(first(question, ["title"])), first(question, ["tags"])),
      ),
  },
];
