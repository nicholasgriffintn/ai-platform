import {
  DISCOVER_MAX_EDITION_CARDS,
  type DiscoverEditionContent,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { attachDiscoverArticles } from "~/modules/discover/domain/articles";
import { discoverTopicKey, listEditionLinks } from "~/modules/discover/domain/edition";
import { buildDiscoverFeedGroups, fillDiscoverFeed } from "~/modules/discover/domain/feed";
import { summariseDiscoverFeedback } from "~/modules/discover/domain/feedback";
import { collectSeenLinks } from "~/modules/discover/domain/links";
import {
  DISCOVER_HEADLINES_TOPIC,
  selectCurrentResearch,
} from "~/modules/discover/domain/research";

import { listDiscoverArticleSources } from "./articles";
import { listRecentDiscoverEditions, updateDiscoverEdition } from "./editions";
import { listDiscoverFeedback } from "./feedback";
import { listDiscoverFollows } from "./follows";
import { listDiscoverDocuments } from "./notebook";

const SEEN_EDITION_COUNT = 7;

export async function topUpDiscoverFeed(
  context: ServiceContext,
  input: { today: string; curate: string },
): Promise<number> {
  const user = context.requireUser();
  const [editions, documents, articleSources, feedback, follows] = await Promise.all([
    listRecentDiscoverEditions(context, user.id, SEEN_EDITION_COUNT),
    listDiscoverDocuments(context, user.id),
    listDiscoverArticleSources(context),
    listDiscoverFeedback(context, user.id),
    listDiscoverFollows(context, user.id),
  ]);
  const [latest, ...earlier] = editions;

  if (!latest || latest.content.date !== input.today) {
    return 0;
  }

  const hiddenTopics = new Set(
    summariseDiscoverFeedback(feedback).hiddenTopics.map(discoverTopicKey),
  );
  const research = selectCurrentResearch(documents.research, {
    today: input.today,
    hiddenTopics,
  });
  const fill = (content: DiscoverEditionContent) =>
    fillDiscoverFeed({
      groups: buildDiscoverFeedGroups({
        research,
        signals: [],
        headlinesTopic: DISCOVER_HEADLINES_TOPIC,
        followedTopics: new Set(follows.map((follow) => discoverTopicKey(follow.topic))),
        curate: input.curate,
        interestOrder: content.interests.map((interest) => interest.topic),
      }),
      seen: collectSeenLinks(
        listEditionLinks([content, ...earlier.map((edition) => edition.content)]),
      ),
      skipTopics: hiddenTopics,
      limit: DISCOVER_MAX_EDITION_CARDS - content.cards.length,
      createId: generateId,
    });
  let added = fill(latest.content).length;

  if (added === 0) {
    return 0;
  }

  await updateDiscoverEdition(context, latest.id, (content) => {
    const cards = fill(content);

    added = cards.length;

    return {
      ...content,
      cards: [...content.cards, ...attachDiscoverArticles(cards, articleSources)],
    };
  });

  return added;
}
